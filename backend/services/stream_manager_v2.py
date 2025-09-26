"""
Stream Manager Service V2

Manages Pump.fun stream selection using real data from PumpFunClient.
"""

import asyncio
import random
import json
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import logging
import aiohttp

from config.settings import settings
from services.pumpfun_client import PumpFunClient
from services.livekit_client import LiveKitClient
from services.pumpfun_websocket_service import PumpFunWebSocketService
from models.token import Token

logger = logging.getLogger(__name__)


class StreamManager:
    """
    Manages Pump.fun stream selection and pairing.

    This class integrates with PumpFunClient to fetch real token data
    and provides random pairing functionality for the roulette feature.
    """

    def __init__(self):
        """Initialize the StreamManager with PumpFunClient."""
        self.pump_client = PumpFunClient(
            db_url=f"{settings.MONGODB_URL}/{settings.MONGODB_DB_NAME}"
        )
        self.livekit_client = LiveKitClient()
        self.pumpfun_websocket_service = PumpFunWebSocketService()
        self.is_initialized = False
        self.recent_pairs = []  # Track recent pairs to avoid repetition
        self.max_recent_pairs = 5  # Keep track of last 5 pairs

        # Redis configuration (optional - can be None)
        self.redis_client = None  # Will be set up if Redis is available
        self.recent_pairs_key = "stream_manager:recent_pairs"
        self.pair_ttl = 3600  # 1 hour TTL for pairs

    async def initialize(self) -> None:
        """
        Initialize the stream manager and start the Pump.fun client.
        """
        logger.info("Initializing StreamManager V2...")

        try:
            # Start the Pump.fun WebSocket client in the background
            asyncio.create_task(self.pump_client.run())

            # Wait a bit for initial data
            await asyncio.sleep(5)

            self.is_initialized = True
            logger.info("StreamManager V2 initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize StreamManager: {e}")
            raise

    async def cleanup(self) -> None:
        """
        Clean up resources and stop the Pump.fun client.
        """
        logger.info("Cleaning up StreamManager...")
        await self.pump_client.disconnect()
        logger.info("StreamManager cleanup complete")

    async def get_active_streams(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get currently active token streams.

        Args:
            limit (int): Maximum number of streams to return

        Returns:
            List[Dict[str, Any]]: List of stream metadata
        """
        try:
            # Get only truly live streaming tokens with recent activity
            tokens = await self.pump_client.get_live_streaming_tokens(limit=limit)

            # Convert to stream format
            streams = []
            for token in tokens:
                stream_url = await self.pump_client.get_token_stream_url(token.mint)

                # Get LiveKit info if token has live stream
                livekit_info = None
                if token.is_currently_live:
                    livekit_info = await self.livekit_client.parse_stream_info(token.model_dump())

                streams.append({
                    "stream_id": token.mint,
                    "stream_url": stream_url,
                    "token_name": token.name,
                    "token_address": token.mint,
                    "streamer_name": getattr(token, 'creator_username', None) or token.creator,  # Full creator name
                    "viewer_count": token.trade_count,  # Use trade count as proxy for activity
                    "thumbnail_url": token.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                    "is_live": token.is_currently_live,
                    "market_cap": token.market_cap,
                    "usd_market_cap": token.usd_market_cap,
                    "created_at": token.created_timestamp.isoformat(),
                    "room_id": livekit_info.get("room_id") if livekit_info else None
                })

            return streams

        except Exception as e:
            logger.error(f"Error fetching active streams: {e}")
            return []

    async def _get_recent_pairs(self) -> List[List[str]]:
        """Get recent pairs from Redis (shared across instances)."""
        if not self.redis_client:
            return []

        try:
            # Get all recent pairs from Redis sorted set
            pairs_data = await self.redis_client.zrange(
                self.recent_pairs_key,
                0,
                -1,
                withscores=False
            )

            recent_pairs = []
            for pair_json in pairs_data:
                try:
                    pair = json.loads(pair_json)
                    recent_pairs.append(pair)
                except:
                    pass

            # Clean up old entries (older than TTL)
            cutoff_time = datetime.now(timezone.utc).timestamp() - self.pair_ttl
            await self.redis_client.zremrangebyscore(
                self.recent_pairs_key,
                0,
                cutoff_time
            )

            return recent_pairs
        except Exception as e:
            logger.error(f"Error getting recent pairs from Redis: {e}")
            return []

    async def _add_recent_pair(self, mint1: str, mint2: str) -> None:
        """Add a pair to recent pairs in Redis."""
        if not self.redis_client:
            return

        try:
            pair = [mint1, mint2]
            pair_json = json.dumps(pair)
            timestamp = datetime.now(timezone.utc).timestamp()

            # Add to Redis sorted set with timestamp as score
            await self.redis_client.zadd(
                self.recent_pairs_key,
                {pair_json: timestamp}
            )

            # Keep only the most recent N pairs
            await self.redis_client.zremrangebyrank(
                self.recent_pairs_key,
                0,
                -(self.max_recent_pairs + 1)
            )

            logger.info(f"Added pair to Redis: {mint1[:8]}...{mint2[:8]}")
        except Exception as e:
            logger.error(f"Error adding recent pair to Redis: {e}")

    async def get_random_pair(self) -> Optional[Dict[str, Any]]:
        """
        Get a random pair of active token streams.

        Returns:
            Optional[Dict[str, Any]]: Stream pair data or None if not enough streams
        """
        try:
            # Import at the top of the function
            from services.pumpfun_chat_client import PumpFunChatClient
            import random

            # First, try to get active livestreams from API
            logger.info("Fetching active livestreams from Pump.fun API...")
            active_livestreams = await PumpFunChatClient.fetch_active_livestreams()

            # Log detailed info about available streams
            logger.info(f"API returned {len(active_livestreams)} active livestreams")
            if active_livestreams:
                logger.info(f"Stream names: {[s.get('name', 'Unknown')[:20] for s in active_livestreams[:10]]}")

            if len(active_livestreams) >= 2:
                logger.info(f"Using {len(active_livestreams)} active livestreams from API")

                # Try to find 2 valid streams with retry logic
                max_retries = 5
                for attempt in range(max_retries):
                    # Get recent pairs from Redis
                    recent_pairs = await self._get_recent_pairs()

                    # Filter out recently used streams
                    available_streams = active_livestreams.copy()

                    # Log recent pairs for debugging
                    logger.info(f"Recent pairs from Redis: {len(recent_pairs)} pairs")
                    if recent_pairs:
                        logger.debug(f"Recent pair mints: {recent_pairs}")

                    # Remove streams that were in recent pairs
                    initial_count = len(available_streams)
                    for recent_pair in recent_pairs:
                        available_streams = [s for s in available_streams
                                           if s.get('mint') not in recent_pair]

                    filtered_count = initial_count - len(available_streams)
                    logger.info(f"Filtered out {filtered_count} recently used streams")

                    # If not enough streams after filtering, use all streams
                    if len(available_streams) < 2:
                        logger.info(f"Only {len(available_streams)} streams after filtering, using all {len(active_livestreams)} available streams")
                        available_streams = active_livestreams

                    # Randomly select 2 streams
                    selected = random.sample(available_streams, min(2, len(available_streams)))

                    # Validate both streams are actually active
                    valid_streams = []
                    for stream_data in selected:
                        mint = stream_data.get('mint')
                        if mint:
                            # Validate stream with LiveKit
                            is_valid = await self.livekit_client.validate_stream_active(mint)
                            if is_valid:
                                valid_streams.append(stream_data)
                                logger.info(f"✅ Validated active stream: {stream_data.get('name')} ({mint})")
                            else:
                                logger.warning(f"❌ Stream validation failed: {stream_data.get('name')} ({mint})")

                    # If we have 2 valid streams, try to build a pair
                    if len(valid_streams) == 2:
                        token1_data = valid_streams[0]
                        token2_data = valid_streams[1]

                        # Generate stream data from API response
                        pair_data = await self._build_stream_pair_from_api(token1_data, token2_data)

                        # If pair is valid (no duplicate rooms), return it
                        if pair_data:
                            logger.info(f"✅ Successfully created valid stream pair on attempt {attempt + 1}")

                            # Track this pair in Redis to avoid repetition
                            await self._add_recent_pair(
                                token1_data.get('mint'),
                                token2_data.get('mint')
                            )

                            # Send notifications to both streamers
                            try:
                                room_id = pair_data.get('room_id')
                                stream_1_mint = token1_data.get('mint')
                                stream_2_mint = token2_data.get('mint')

                                if room_id and stream_1_mint and stream_2_mint:
                                    logger.info(f"🔔 Sending notifications to streamers: {stream_1_mint[:8]}... and {stream_2_mint[:8]}...")
                                    notification_results = await self.pumpfun_websocket_service.notify_both_streamers(
                                        stream_1_mint, stream_2_mint, room_id
                                    )
                                    logger.info(f"📢 Notification results: {notification_results}")
                            except Exception as e:
                                logger.error(f"❌ Failed to send notifications: {e}")

                            return pair_data
                        else:
                            logger.warning(f"⚠️ Attempt {attempt + 1}: Streams had duplicate room IDs, retrying with different streams...")
                            # Continue to next iteration to select different streams
                            continue

                    logger.warning(f"Attempt {attempt + 1}: Only found {len(valid_streams)} valid streams, retrying...")

            # Fallback to database tokens (less reliable)
            logger.info("API failed or insufficient streams, falling back to database tokens...")
            live_streaming_tokens = await self.pump_client.get_live_streaming_tokens(limit=100)  # Increase limit

            logger.info(f"Got {len(live_streaming_tokens)} live streaming tokens from database")
            if live_streaming_tokens:
                logger.info(f"Token names from DB: {[t.name[:20] for t in live_streaming_tokens[:10]]}")

            if len(live_streaming_tokens) < 2:
                logger.warning(f"Not enough live streaming tokens: {len(live_streaming_tokens)}")
                return None

            # Try to avoid recently used tokens in DB fallback too
            available_tokens = live_streaming_tokens

            # Get recent pairs from Redis for DB fallback filtering
            recent_pairs = await self._get_recent_pairs()

            # Filter out recent pairs from DB tokens
            if recent_pairs:
                filtered_tokens = []
                for token in live_streaming_tokens:
                    mint_in_recent = False
                    for recent_pair in recent_pairs:
                        if token.mint in recent_pair:
                            mint_in_recent = True
                            break
                    if not mint_in_recent:
                        filtered_tokens.append(token)

                if len(filtered_tokens) >= 2:
                    logger.info(f"Filtered DB tokens: {len(filtered_tokens)} available after removing recent")
                    available_tokens = filtered_tokens
                else:
                    logger.info(f"Not enough filtered tokens ({len(filtered_tokens)}), using all {len(live_streaming_tokens)}")

            # Select two random live streaming tokens
            selected = random.sample(available_tokens, 2)
            token_pair = (selected[0], selected[1])
            logger.info(f"✅ Selected live streams from DB: {selected[0].name} & {selected[1].name}")

            if not token_pair:
                logger.warning("Not enough active tokens for pairing")
                return None

            token1, token2 = token_pair

            # Generate stream URLs
            stream_url_1 = await self.pump_client.get_token_stream_url(token1.mint)
            stream_url_2 = await self.pump_client.get_token_stream_url(token2.mint)

            # Get LiveKit info for live streams - ENSURE NO MIXING
            livekit_info_1 = None
            livekit_info_2 = None

            # Process stream 1
            if token1.is_currently_live:
                token1_data = token1.model_dump()
                logger.info(f"Processing stream 1: {token1.name} ({token1.mint[:8]}...)")
                livekit_info_1 = await self.livekit_client.parse_stream_info(token1_data)
                if livekit_info_1:
                    logger.info(f"Stream 1 LiveKit info: room={livekit_info_1.get('room_id')}, mint={livekit_info_1.get('mint')[:8]}...")

            # Process stream 2
            if token2.is_currently_live:
                token2_data = token2.model_dump()
                logger.info(f"Processing stream 2: {token2.name} ({token2.mint[:8]}...)")
                livekit_info_2 = await self.livekit_client.parse_stream_info(token2_data)
                if livekit_info_2:
                    logger.info(f"Stream 2 LiveKit info: room={livekit_info_2.get('room_id')}, mint={livekit_info_2.get('mint')[:8]}...")

            # Validate we have different streams with different rooms
            if livekit_info_1 and livekit_info_2:
                room1 = livekit_info_1.get('room_id')
                room2 = livekit_info_2.get('room_id')

                # Check if rooms are the same
                if room1 == room2:
                    logger.error(f"❌ CRITICAL: Both streams have same room_id: {room1}")
                    logger.error(f"Stream 1: {token1.name} ({token1.mint[:8]}...) -> Room: {room1}")
                    logger.error(f"Stream 2: {token2.name} ({token2.mint[:8]}...) -> Room: {room2}")
                    # Mark this as invalid pair and return None to trigger retry
                    return None

                # Additional validation: Check if mint addresses in room IDs match the tokens
                if room1 and token1.mint not in room1:
                    logger.warning(f"⚠️ Room ID mismatch for stream 1: Token {token1.mint[:8]} not in room {room1}")
                if room2 and token2.mint not in room2:
                    logger.warning(f"⚠️ Room ID mismatch for stream 2: Token {token2.mint[:8]} not in room {room2}")

            # Add this pair to Redis to avoid repetition
            await self._add_recent_pair(token1.mint, token2.mint)

            # Create response format
            return {
                "room_id": f"{token1.mint[:8]}_{token2.mint[:8]}",
                "stream_1": {
                    "stream_id": token1.mint,
                    "streamer_id": token1.creator,
                    "stream_url": stream_url_1,
                    "token_name": token1.name,
                    "token_address": token1.mint,
                    "streamer_name": getattr(token1, 'creator_username', None) or token1.creator,
                    "viewer_count": token1.trade_count,
                    "thumbnail_url": token1.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                    "is_live": token1.is_currently_live,
                    "room_id": livekit_info_1.get("room_id") if livekit_info_1 else None,
                    # Market data
                    "market_cap": getattr(token1, 'market_cap', 0),
                    "usd_market_cap": getattr(token1, 'usd_market_cap', 0),
                    "sol_amount": getattr(token1, 'sol_amount', 0),
                    "token_amount": getattr(token1, 'token_amount', 0),
                    "virtual_sol_reserves": getattr(token1, 'virtual_sol_reserves', 0),
                    "virtual_token_reserves": getattr(token1, 'virtual_token_reserves', 0),
                    "reply_count": getattr(token1, 'reply_count', 0),
                    "description": getattr(token1, 'description', None),
                    "symbol": getattr(token1, 'symbol', 'TOKEN'),
                    "twitter": getattr(token1, 'twitter', None),
                    "telegram": getattr(token1, 'telegram', None),
                    "website": getattr(token1, 'website', None),
                    "is_nsfw": getattr(token1, 'nsfw', False),
                    "creator_username": getattr(token1, 'creator_username', None),
                    "creator_profile_image": getattr(token1, 'creator_profile_image', None),
                    "total_supply": getattr(token1, 'total_supply', 1000000000000000),
                    "price_change_24h": getattr(token1, 'price_change_24h', 0),
                    "volume_24h": getattr(token1, 'volume_24h', 0),
                    "holders": getattr(token1, 'holders', 0),
                    "is_trending": getattr(token1, 'is_trending', False),
                    "is_verified": getattr(token1, 'is_verified', False)
                },
                "stream_2": {
                    "stream_id": token2.mint,
                    "streamer_id": token2.creator,
                    "stream_url": stream_url_2,
                    "token_name": token2.name,
                    "token_address": token2.mint,
                    "streamer_name": getattr(token2, 'creator_username', None) or token2.creator,
                    "viewer_count": token2.trade_count,
                    "thumbnail_url": token2.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                    "is_live": token2.is_currently_live,
                    "room_id": livekit_info_2.get("room_id") if livekit_info_2 else None,
                    # Market data
                    "market_cap": getattr(token2, 'market_cap', 0),
                    "usd_market_cap": getattr(token2, 'usd_market_cap', 0),
                    "sol_amount": getattr(token2, 'sol_amount', 0),
                    "token_amount": getattr(token2, 'token_amount', 0),
                    "virtual_sol_reserves": getattr(token2, 'virtual_sol_reserves', 0),
                    "virtual_token_reserves": getattr(token2, 'virtual_token_reserves', 0),
                    "reply_count": getattr(token2, 'reply_count', 0),
                    "description": getattr(token2, 'description', None),
                    "symbol": getattr(token2, 'symbol', 'TOKEN'),
                    "twitter": getattr(token2, 'twitter', None),
                    "telegram": getattr(token2, 'telegram', None),
                    "website": getattr(token2, 'website', None),
                    "is_nsfw": getattr(token2, 'nsfw', False),
                    "creator_username": getattr(token2, 'creator_username', None),
                    "creator_profile_image": getattr(token2, 'creator_profile_image', None),
                    "total_supply": getattr(token2, 'total_supply', 1000000000000000),
                    "price_change_24h": getattr(token2, 'price_change_24h', 0),
                    "volume_24h": getattr(token2, 'volume_24h', 0),
                    "holders": getattr(token2, 'holders', 0),
                    "is_trending": getattr(token2, 'is_trending', False),
                    "is_verified": getattr(token2, 'is_verified', False)
                }
            }

        except Exception as e:
            logger.error(f"Error getting random pair: {e}")
            # Never return mock data - raise the error instead
            raise

    async def get_stream_by_mint(self, mint: str) -> Optional[Dict[str, Any]]:
        """
        Get stream data for a specific token by mint address.

        Args:
            mint (str): Token mint address

        Returns:
            Optional[Dict[str, Any]]: Stream data or None if not found
        """
        try:
            # Find token in database
            token = await Token.find_one(Token.mint == mint)

            if not token:
                return None

            stream_url = await self.pump_client.get_token_stream_url(token.mint)

            return {
                "stream_id": token.mint,
                "streamer_id": token.creator,  # Add streamer ID
                "stream_url": stream_url,
                "token_name": token.name,
                "token_address": token.mint,
                "streamer_name": token.creator[:8] + "...",
                "viewer_count": token.trade_count,
                "thumbnail_url": token.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                "is_live": token.is_currently_live,
                "market_cap": token.market_cap,
                "usd_market_cap": token.usd_market_cap
            }

        except Exception as e:
            logger.error(f"Error fetching stream by mint: {e}")
            return None

    async def fetch_token_from_api(self, mint: str) -> Optional[Dict[str, Any]]:
        """
        Fetch token data directly from Pump.fun API.

        Args:
            mint (str): Token mint address

        Returns:
            Optional[Dict[str, Any]]: Token data from API or None if not found
        """
        try:
            url = f"https://frontend-api-v3.pump.fun/coins/{mint}"

            headers = {
                'accept': 'application/json',
                'origin': 'https://pump.fun',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Successfully fetched token {mint} from API")
                        return data
                    else:
                        logger.warning(f"Failed to fetch token {mint} from API: {response.status}")
                        return None

        except Exception as e:
            logger.error(f"Error fetching token {mint} from API: {e}")
            return None

    async def get_custom_pair(self, token1_mint: str, token2_mint: str) -> Optional[Dict[str, Any]]:
        """
        Get a custom pair of streams using specific token mint addresses.

        Args:
            token1_mint (str): First token mint address
            token2_mint (str): Second token mint address

        Returns:
            Optional[Dict[str, Any]]: Stream pair data or None if not found
        """
        try:
            # First try to fetch from database
            token1 = await Token.find_one(Token.mint == token1_mint)
            token2 = await Token.find_one(Token.mint == token2_mint)

            # If not in database, fetch from API
            token1_data = None
            token2_data = None

            if not token1:
                logger.info(f"Token {token1_mint} not in database, fetching from API")
                token1_data = await self.fetch_token_from_api(token1_mint)
                if not token1_data:
                    logger.warning(f"Token {token1_mint} not found in API")
                    return None

            if not token2:
                logger.info(f"Token {token2_mint} not in database, fetching from API")
                token2_data = await self.fetch_token_from_api(token2_mint)
                if not token2_data:
                    logger.warning(f"Token {token2_mint} not found in API")
                    return None

            # Generate room ID based on the two tokens
            mint1 = token1.mint if token1 else token1_data['mint']
            mint2 = token2.mint if token2 else token2_data['mint']
            room_id = f"{mint1[:8]}_{mint2[:8]}_{int(datetime.now(timezone.utc).timestamp())}"

            # Get stream URLs
            stream1_url = f"https://pump.fun/coin/{mint1}"
            stream2_url = f"https://pump.fun/coin/{mint2}"

            # Get LiveKit info for both streams if they're live
            livekit_info_1 = None
            livekit_info_2 = None

            # Check if tokens are live and get LiveKit info
            is_live_1 = token1.is_currently_live if token1 else token1_data.get('is_currently_live', False)
            is_live_2 = token2.is_currently_live if token2 else token2_data.get('is_currently_live', False)

            if is_live_1:
                token_dict_1 = token1.model_dump() if token1 else token1_data
                livekit_info_1 = await self.livekit_client.parse_stream_info(token_dict_1)

            if is_live_2:
                token_dict_2 = token2.model_dump() if token2 else token2_data
                livekit_info_2 = await self.livekit_client.parse_stream_info(token_dict_2)

            # Build stream 1 data
            if token1:
                stream1_data = {
                    "stream_id": token1.mint,
                    "streamer_id": token1.creator,
                    "stream_url": stream1_url,
                    "token_name": token1.name,
                    "token_address": token1.mint,
                    "streamer_name": getattr(token1, 'creator_username', None) or token1.creator,
                    "viewer_count": token1.trade_count,
                    "thumbnail_url": getattr(token1, 'thumbnail', None) or token1.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                    "is_live": token1.is_currently_live,
                    "room_id": livekit_info_1.get("room_id") if livekit_info_1 else None,
                    "market_cap": getattr(token1, 'market_cap', 0),
                    "usd_market_cap": getattr(token1, 'usd_market_cap', 0),
                    "symbol": getattr(token1, 'symbol', 'TOKEN'),
                    "description": getattr(token1, 'description', None),
                }
            else:
                # Use API data
                stream1_data = {
                    "stream_id": token1_data['mint'],
                    "streamer_id": token1_data['creator'],
                    "stream_url": stream1_url,
                    "token_name": token1_data['name'],
                    "token_address": token1_data['mint'],
                    "streamer_name": token1_data.get('creator_username') or token1_data['creator'][:8] + '...',
                    "viewer_count": token1_data.get('num_participants', 0),
                    "thumbnail_url": token1_data.get('thumbnail') or token1_data.get('image_uri', f"{settings.PUMP_FUN_BASE_URL}/placeholder.png"),
                    "is_live": token1_data.get('is_currently_live', False),
                    "room_id": livekit_info_1.get("room_id") if livekit_info_1 else None,
                    "market_cap": token1_data.get('market_cap', 0),
                    "usd_market_cap": token1_data.get('usd_market_cap', 0),
                    "symbol": token1_data.get('symbol', 'TOKEN'),
                    "description": token1_data.get('description', None),
                }

            # Build stream 2 data
            if token2:
                stream2_data = {
                    "stream_id": token2.mint,
                    "streamer_id": token2.creator,
                    "stream_url": stream2_url,
                    "token_name": token2.name,
                    "token_address": token2.mint,
                    "streamer_name": getattr(token2, 'creator_username', None) or token2.creator,
                    "viewer_count": token2.trade_count,
                    "thumbnail_url": getattr(token2, 'thumbnail', None) or token2.image_uri or f"{settings.PUMP_FUN_BASE_URL}/placeholder.png",
                    "is_live": token2.is_currently_live,
                    "room_id": livekit_info_2.get("room_id") if livekit_info_2 else None,
                    "market_cap": getattr(token2, 'market_cap', 0),
                    "usd_market_cap": getattr(token2, 'usd_market_cap', 0),
                    "symbol": getattr(token2, 'symbol', 'TOKEN'),
                    "description": getattr(token2, 'description', None),
                }
            else:
                # Use API data
                stream2_data = {
                    "stream_id": token2_data['mint'],
                    "streamer_id": token2_data['creator'],
                    "stream_url": stream2_url,
                    "token_name": token2_data['name'],
                    "token_address": token2_data['mint'],
                    "streamer_name": token2_data.get('creator_username') or token2_data['creator'][:8] + '...',
                    "viewer_count": token2_data.get('num_participants', 0),
                    "thumbnail_url": token2_data.get('thumbnail') or token2_data.get('image_uri', f"{settings.PUMP_FUN_BASE_URL}/placeholder.png"),
                    "is_live": token2_data.get('is_currently_live', False),
                    "room_id": livekit_info_2.get("room_id") if livekit_info_2 else None,
                    "market_cap": token2_data.get('market_cap', 0),
                    "usd_market_cap": token2_data.get('usd_market_cap', 0),
                    "symbol": token2_data.get('symbol', 'TOKEN'),
                    "description": token2_data.get('description', None),
                }

            pair_data = {
                "room_id": room_id,
                "stream_1": stream1_data,
                "stream_2": stream2_data
            }

            # Send notifications to both streamers
            try:
                if mint1 and mint2 and room_id:
                    logger.info(f"🔔 Sending notifications for custom pair: {mint1[:8]}... and {mint2[:8]}...")
                    notification_results = await self.pumpfun_websocket_service.notify_both_streamers(
                        mint1, mint2, room_id
                    )
                    logger.info(f"📢 Custom pair notification results: {notification_results}")
            except Exception as e:
                logger.error(f"❌ Failed to send custom pair notifications: {e}")

            return pair_data

        except Exception as e:
            logger.error(f"Error getting custom pair: {e}")
            return None

    async def _build_stream_pair_from_api(self, token1_data: Dict, token2_data: Dict) -> Dict[str, Any]:
        """
        Build stream pair response from API data.

        Args:
            token1_data: First token data from API
            token2_data: Second token data from API

        Returns:
            Dict with stream pair information
        """
        try:
            # Generate room ID
            room_id = f"{token1_data['mint'][:8]}_{token2_data['mint'][:8]}"

            # Get LiveKit info for both streams - ENSURE SEPARATE PROCESSING
            logger.info(f"Building stream pair from API - Token1: {token1_data.get('name')} ({token1_data['mint'][:8]}...)")
            livekit_info_1 = await self.livekit_client.parse_stream_info(token1_data)

            logger.info(f"Building stream pair from API - Token2: {token2_data.get('name')} ({token2_data['mint'][:8]}...)")
            livekit_info_2 = await self.livekit_client.parse_stream_info(token2_data)

            # Validate different rooms
            if livekit_info_1 and livekit_info_2:
                if livekit_info_1.get('room_id') == livekit_info_2.get('room_id'):
                    logger.error(f"❌ Stream pair has same room_id: {livekit_info_1.get('room_id')}")
                    raise Exception("Both streams have same room_id")

            # Build response
            return {
                "room_id": room_id,
                "stream_1": {
                    "stream_id": token1_data['mint'],
                    "streamer_id": token1_data.get('creator', ''),
                    "stream_url": f"https://pump.fun/coin/{token1_data['mint']}",
                    "token_name": token1_data.get('name', 'Unknown'),
                    "token_address": token1_data['mint'],
                    "streamer_name": token1_data.get('creator_username') or token1_data.get('creator', '')[:8] + '...',
                    "viewer_count": token1_data.get('num_participants', 0),
                    "thumbnail_url": token1_data.get('image_uri', ''),
                    "is_live": True,  # We know it's live from validation
                    "room_id": livekit_info_1.get("room_id") if livekit_info_1 else None,
                    "market_cap": token1_data.get('market_cap', 0),
                    "usd_market_cap": token1_data.get('usd_market_cap', 0),
                    "symbol": token1_data.get('symbol', 'TOKEN'),
                    "description": token1_data.get('description', None),
                },
                "stream_2": {
                    "stream_id": token2_data['mint'],
                    "streamer_id": token2_data.get('creator', ''),
                    "stream_url": f"https://pump.fun/coin/{token2_data['mint']}",
                    "token_name": token2_data.get('name', 'Unknown'),
                    "token_address": token2_data['mint'],
                    "streamer_name": token2_data.get('creator_username') or token2_data.get('creator', '')[:8] + '...',
                    "viewer_count": token2_data.get('num_participants', 0),
                    "thumbnail_url": token2_data.get('image_uri', ''),
                    "is_live": True,  # We know it's live from validation
                    "room_id": livekit_info_2.get("room_id") if livekit_info_2 else None,
                    "market_cap": token2_data.get('market_cap', 0),
                    "usd_market_cap": token2_data.get('usd_market_cap', 0),
                    "symbol": token2_data.get('symbol', 'TOKEN'),
                    "description": token2_data.get('description', None),
                }
            }

        except Exception as e:
            logger.error(f"Error building stream pair from API data: {e}")
            raise

    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current stream state.

        Returns:
            Dict[str, Any]: Statistics including stream counts
        """
        # Get count of active tokens from cache
        active_count = len(self.pump_client.active_tokens)

        return {
            "total_streams": active_count,
            "active_streams": active_count,
            "is_connected": self.pump_client.is_connected,
            "last_refresh": datetime.now(timezone.utc).isoformat()
        }