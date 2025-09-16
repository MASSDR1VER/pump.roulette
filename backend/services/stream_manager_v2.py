"""
Stream Manager Service V2

Manages Pump.fun stream selection using real data from PumpFunClient.
"""

import asyncio
import random
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import logging

from config.settings import settings
from services.pumpfun_client import PumpFunClient
from services.livekit_client import LiveKitClient
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
        self.is_initialized = False

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
                    "room_id": livekit_info.get("room_id") if livekit_info else None,
                    "access_token": livekit_info.get("access_token") if livekit_info else None
                })

            return streams

        except Exception as e:
            logger.error(f"Error fetching active streams: {e}")
            return []

    async def get_random_pair(self) -> Optional[Dict[str, Any]]:
        """
        Get a random pair of active token streams.

        Returns:
            Optional[Dict[str, Any]]: Stream pair data or None if not enough streams
        """
        try:
            # Get ONLY tokens with live streams (is_currently_live = true)
            logger.info("Fetching live streaming tokens...")
            live_streaming_tokens = await self.pump_client.get_live_streaming_tokens(limit=50)

            logger.info(f"Got {len(live_streaming_tokens)} live streaming tokens")

            if len(live_streaming_tokens) < 2:
                logger.warning(f"Not enough live streaming tokens: {len(live_streaming_tokens)}")
                # Log the tokens we did find for debugging
                for token in live_streaming_tokens:
                    logger.info(f"Available token: {token.name} (live: {token.is_currently_live})")
                # Don't fallback to non-live tokens, just return None
                return None

            # Select two random live streaming tokens
            import random
            selected = random.sample(live_streaming_tokens, 2)
            token_pair = (selected[0], selected[1])
            logger.info(f"✅ Selected live streams: {selected[0].name} & {selected[1].name}")

            if not token_pair:
                logger.warning("Not enough active tokens for pairing")
                return None

            token1, token2 = token_pair

            # Generate stream URLs
            stream_url_1 = await self.pump_client.get_token_stream_url(token1.mint)
            stream_url_2 = await self.pump_client.get_token_stream_url(token2.mint)

            # Get LiveKit info for live streams
            livekit_info_1 = None
            livekit_info_2 = None

            if token1.is_currently_live:
                livekit_info_1 = await self.livekit_client.parse_stream_info(token1.model_dump())
            if token2.is_currently_live:
                livekit_info_2 = await self.livekit_client.parse_stream_info(token2.model_dump())

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
                    "access_token": livekit_info_1.get("access_token") if livekit_info_1 else None,
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
                    "access_token": livekit_info_2.get("access_token") if livekit_info_2 else None,
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

            # Return mock data as fallback
            return {
                "room_id": f"demo_{datetime.now(timezone.utc).timestamp()}",
                "stream_1": {
                    "stream_id": "demo1",
                    "streamer_id": "demo_streamer_1",  # Add demo streamer ID
                    "stream_url": f"{settings.PUMP_FUN_BASE_URL}/coin/demo1",
                    "token_name": "Demo Token 1",
                    "token_address": "demo1_address",
                    "streamer_name": "DemoStreamer1",
                    "viewer_count": 0,
                    "thumbnail_url": f"{settings.PUMP_FUN_BASE_URL}/placeholder.png"
                },
                "stream_2": {
                    "stream_id": "demo2",
                    "streamer_id": "demo_streamer_2",  # Add demo streamer ID
                    "stream_url": f"{settings.PUMP_FUN_BASE_URL}/coin/demo2",
                    "token_name": "Demo Token 2",
                    "token_address": "demo2_address",
                    "streamer_name": "DemoStreamer2",
                    "viewer_count": 0,
                    "thumbnail_url": f"{settings.PUMP_FUN_BASE_URL}/placeholder.png"
                }
            }

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