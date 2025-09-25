"""
LiveKit WebRTC Client for Pump.fun Streams

Handles JWT token generation and WebRTC connections for live streams.
"""

import jwt
import time
import json
import uuid
import logging
import aiohttp
import base64
import hmac
import hashlib
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class LiveKitClient:
    """
    Client for connecting to Pump.fun's LiveKit WebRTC streams.

    LiveKit is used by Pump.fun for live streaming functionality.
    """

    # LiveKit configuration from Pump.fun
    LIVEKIT_URL = "wss://pump-prod-tg2x8veh.livekit.cloud/rtc"
    API_KEY = "APIdURVfRJjV9sP"  # From the decoded JWT

    # Secret key from Pump.fun
    SECRET_KEY = "KHbc/hmFL/EL8h/b+JedEg=="

    def __init__(self):
        """Initialize the LiveKit client."""
        self.active_streams = {}

    async def get_livestream_info(self, token_mint: str) -> Optional[Dict[str, Any]]:
        """
        Get livestream information from Pump.fun API.

        Args:
            token_mint: Token mint address

        Returns:
            Livestream info including stream ID
        """
        url = f"https://livestream-api.pump.fun/livestream?mintId={token_mint}"

        headers = {
            'accept': 'application/json',
            'origin': 'https://pump.fun',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Got livestream info for {token_mint}: stream_id={data.get('id')}")
                        return data
                    else:
                        logger.warning(f"Failed to get livestream info: {response.status}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching livestream info: {e}")
            return None

    def generate_access_token(self, token_mint: str, stream_id: str) -> str:
        """
        Generate JWT access token for LiveKit.

        Args:
            token_mint: Token mint address
            stream_id: Stream ID

        Returns:
            JWT access token
        """
        room_id = f"{token_mint}:{stream_id}"

        # Generate anonymous sub ID
        import uuid
        sub_id = uuid.uuid4().hex[:8]

        # Token payload matching Pump.fun format exactly
        payload = {
            "video": {
                "roomJoin": True,
                "roomCreate": False,
                "canPublish": False,
                "canSubscribe": True,
                "canPublishData": True,
                "room": room_id,
                "hidden": False
            },
            "metadata": '{"anon":true,"hand_raised":false,"invited_to_stage":false,"screen_share_request_timestamp":null,"role":"viewer"}',
            "iss": self.API_KEY,
            "exp": int(time.time()) + (30 * 24 * 60 * 60),  # 30 days
            "nbf": 0,
            "sub": sub_id
        }

        try:
            # Generate token without 'typ' header to match Pump.fun
            # PyJWT kütüphanesi headers={} ile bile 'typ' ekliyor
            # Bunu engellemek için özel bir çözüm gerekiyor
            import base64
            import hmac
            import hashlib

            # Header'ı manuel oluştur (sadece alg)
            header = {"alg": "HS256"}

            # Base64 encode header and payload
            header_b64 = base64.urlsafe_b64encode(
                json.dumps(header, separators=(',', ':')).encode()
            ).decode().rstrip('=')

            payload_b64 = base64.urlsafe_b64encode(
                json.dumps(payload, separators=(',', ':')).encode()
            ).decode().rstrip('=')

            # Create signature
            message = f"{header_b64}.{payload_b64}"
            signature = base64.urlsafe_b64encode(
                hmac.new(
                    self.SECRET_KEY.encode(),
                    message.encode(),
                    hashlib.sha256
                ).digest()
            ).decode().rstrip('=')

            token = f"{message}.{signature}"
            logger.info(f"Generated JWT token for room {room_id}")
            return token
        except Exception as e:
            logger.error(f"Failed to generate token: {e}")
            return ""

    async def validate_stream_active(self, token_mint: str) -> bool:
        """
        Validate if a stream is actually active by checking LiveKit room status.

        Args:
            token_mint: Token mint address

        Returns:
            bool: True if stream is active with participants, False otherwise
        """
        try:
            # First get livestream info from Pump.fun
            livestream_info = await self.get_livestream_info(token_mint)

            if not livestream_info:
                logger.warning(f"No livestream info found for {token_mint}")
                return False

            # Check if stream has participants
            num_participants = livestream_info.get('num_participants', 0)
            is_live = livestream_info.get('is_live', False)

            logger.info(f"Stream validation for {token_mint}: is_live={is_live}, participants={num_participants}")

            # Stream is valid if it's marked as live AND has at least 1 participant (the streamer)
            return is_live and num_participants > 0

        except Exception as e:
            logger.error(f"Error validating stream {token_mint}: {e}")
            return False

    async def get_access_token_from_pump(self, mint_id: str) -> Optional[str]:
        """
        Get access token from Pump.fun's join endpoint.

        Args:
            mint_id: Token mint address

        Returns:
            Access token or None
        """
        url = "https://livestream-api.pump.fun/livestream/join"

        headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'origin': 'https://pump.fun',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }

        data = {
            "mintId": mint_id,
            "viewer": True
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=data) as response:
                    if response.status in [200, 201]:  # Both 200 OK and 201 Created are success
                        result = await response.json()
                        token = result.get("token")
                        logger.info(f"Got access token from Pump.fun for {mint_id}")
                        return token
                    else:
                        text = await response.text()
                        logger.warning(f"Failed to get token from Pump.fun: {response.status} - {text}")
                        return None
        except Exception as e:
            logger.error(f"Error getting token from Pump.fun: {e}")
            return None

    async def parse_stream_info(self, token_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Parse stream information from token data.

        Args:
            token_data: Token data from Pump.fun WebSocket

        Returns:
            Stream connection info if live, None otherwise
        """
        if not token_data.get("is_currently_live"):
            logger.debug(f"Token {token_data.get('mint')} is not currently live")
            return None

        mint = token_data.get("mint", "")
        logger.info(f"Processing live stream for token: {mint}")

        # Get actual stream ID from Pump.fun livestream API
        livestream_info = await self.get_livestream_info(mint)

        if not livestream_info:
            logger.warning(f"Could not fetch livestream info for {mint}")
            return None

        if not livestream_info.get('isLive'):
            logger.warning(f"Livestream not active for {mint}: {livestream_info}")
            return None

        stream_id = str(livestream_info['id'])  # This is the actual stream ID

        # IMPORTANT: Use the exact room_id format that Pump.fun expects
        # This MUST match what's in the JWT token
        room_id = f"{mint}:{stream_id}"

        # Get access token from Pump.fun's join endpoint
        logger.info(f"Getting access token for {mint} with room_id: {room_id}")
        access_token = await self.get_access_token_from_pump(mint)

        if not access_token:
            logger.error(f"Failed to get access token for {mint}")
            return None

        # Decode token to verify room_id matches
        try:
            import jwt
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            token_room = decoded.get('video', {}).get('room', '')
            logger.info(f"✅ Token validation - Token room: {token_room}, Expected room: {room_id}")

            if token_room != room_id:
                logger.error(f"❌ CRITICAL: Room mismatch! Token has: {token_room}, We expect: {room_id}")
                # The token from Pump.fun has the correct room, use that
                room_id = token_room
                logger.info(f"Using room from token: {room_id}")
        except Exception as e:
            logger.error(f"Failed to decode token for verification: {e}")

        logger.info(f"Successfully got access token for {mint}, final room: {room_id}")

        stream_info = {
            "mint": mint,
            "name": token_data.get("name", "Unknown"),
            "symbol": token_data.get("symbol", ""),
            "livekit_url": self.LIVEKIT_URL,
            "room_id": room_id,  # Use the verified room_id
            "access_token": access_token,
            "thumbnail": token_data.get("image_uri", "") or token_data.get("thumbnail", ""),
            "is_live": True,
            "viewer_count": livestream_info.get("numParticipants", 0),
            "stream_id": stream_id  # Keep stream_id for reference
        }

        return stream_info

    def get_stream_connection_url(self, access_token: str) -> str:
        """
        Get the full WebSocket URL with access token for connecting to a stream.

        Args:
            access_token: JWT access token

        Returns:
            Full WebSocket URL with access token parameter
        """
        # Construct full WebSocket URL with parameters
        ws_url = (
            f"{self.LIVEKIT_URL}"
            f"?access_token={access_token}"
            f"&auto_subscribe=1"
            f"&sdk=js"
            f"&version=2.15.5"
            f"&protocol=16"
        )

        return ws_url

    def decode_token(self, token: str) -> Dict[str, Any]:
        """
        Decode a JWT token to inspect its contents (for debugging).

        Args:
            token: JWT token string

        Returns:
            Decoded token payload
        """
        try:
            # Decode without verification for debugging
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            logger.error(f"Failed to decode token: {e}")
            return {}