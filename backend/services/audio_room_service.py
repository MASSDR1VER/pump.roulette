"""
Audio Room Service for Streamer Conversations

Manages WebRTC audio rooms for paired streamers using LiveKit.
Handles room creation, token generation, and audio mixing for viewers.
"""

import time
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple, List
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv()

logger = logging.getLogger(__name__)


class AudioRoomService:
    """
    Service for managing audio conversations between paired streamers.

    Features:
    - Creates LiveKit rooms for audio communication
    - Generates JWT tokens for streamers (publishers) and viewers (subscribers)
    - Manages room lifecycle and cleanup
    """

    def __init__(self):
        """Initialize the audio room service with LiveKit configuration."""
        # LiveKit Cloud configuration from environment variables
        self.livekit_url = os.getenv("LIVEKIT_URL", "wss://localhost:7880")
        self.api_key = os.getenv("LIVEKIT_API_KEY", "")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET", "")

        # Validate LiveKit credentials
        if not self.api_key or not self.api_secret:
            logger.warning(
                "LiveKit API credentials not configured. Audio rooms will not work. "
                "Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables."
            )
            # For development, you can use LiveKit's test server
            # Get free cloud account at: https://cloud.livekit.io
            # Or run locally: docker run --rm -p 7880:7880 livekit/livekit-server --dev

        # Store active rooms
        self.active_rooms: Dict[str, Dict[str, Any]] = {}

        logger.info("Audio Room Service initialized")

    async def create_audio_room(self, pair_id: str, streamer_a_id: str, streamer_b_id: str, summoner_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new audio room for a stream pair.

        Args:
            pair_id: Unique identifier for the stream pair
            streamer_a_id: First streamer's identifier
            streamer_b_id: Second streamer's identifier

        Returns:
            Room information including join URLs and tokens
        """
        room_name = f"audio_{pair_id}"

        # Generate unique join tokens for each streamer
        token_a = self._generate_streamer_token(room_name, streamer_a_id, "Streamer A")
        token_b = self._generate_streamer_token(room_name, streamer_b_id, "Streamer B")

        # Generate join URLs
        join_url_a = f"/talk?pair={pair_id}&token={token_a}&role=streamer"
        join_url_b = f"/talk?pair={pair_id}&token={token_b}&role=streamer"

        # Store room information
        room_info = {
            "pair_id": pair_id,
            "room_name": room_name,
            "streamer_a": {
                "id": streamer_a_id,
                "token": token_a,
                "join_url": join_url_a,
                "joined": False
            },
            "streamer_b": {
                "id": streamer_b_id,
                "token": token_b,
                "join_url": join_url_b,
                "joined": False
            },
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=2),
            "viewer_count": 0,
            "summoner_id": None,  # Will be set when viewer creates the room
            "viewer_notified": False  # Track if viewer has been notified
        }

        room_info["summoner_id"] = summoner_id
        self.active_rooms[pair_id] = room_info

        logger.info(f"Created audio room for pair {pair_id}")

        # Log test link for manual testing
        logger.info("=" * 80)
        logger.info("🎤 AUDIO ROOM TEST LINK:")
        logger.info(f"Room: {room_name}")
        logger.info(f"Open this in browser to test as streamer:")
        logger.info(f"http://localhost:3001/?room={pair_id}")
        logger.info("Streamer A Token:")
        logger.info(token_a)
        logger.info("Streamer B Token:")
        logger.info(token_b)
        logger.info("=" * 80)

        return room_info

    def _generate_streamer_token(self, room_name: str, user_id: str, display_name: str) -> str:
        """
        Generate JWT token for a streamer with publish permissions using official SDK.

        Args:
            room_name: LiveKit room name
            user_id: Unique user identifier
            display_name: Display name for the user

        Returns:
            JWT token string
        """
        # Use official LiveKit SDK for token generation
        token = api.AccessToken(self.api_key, self.api_secret)
        token = token.with_identity(user_id)
        token = token.with_name(display_name)
        token = token.with_metadata(f'{{"role":"streamer","display_name":"{display_name}"}}')
        token = token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        ))

        return token.to_jwt()

    def generate_viewer_token(self, pair_id: str, viewer_id: Optional[str] = None) -> Optional[str]:
        """
        Generate JWT token for a viewer with subscribe-only permissions using official SDK.

        Args:
            pair_id: Stream pair identifier
            viewer_id: Optional viewer identifier

        Returns:
            JWT token string or None if room doesn't exist
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            logger.warning(f"No audio room found for pair {pair_id}")
            return None

        room_name = room_info["room_name"]
        viewer_id = viewer_id or f"viewer_{uuid.uuid4().hex[:8]}"
        display_name = f"Viewer {viewer_id[-4:]}"

        # Use official LiveKit SDK for token generation
        # IMPORTANT: Give viewers canPublishData=true so they can create/join rooms
        token = api.AccessToken(self.api_key, self.api_secret)
        token = token.with_identity(viewer_id)
        token = token.with_name(display_name)
        token = token.with_metadata(f'{{"role":"viewer","display_name":"{display_name}"}}')
        token = token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,  # Cannot publish audio/video
            can_subscribe=True,  # Can listen to audio
            can_publish_data=True  # Can publish data (allows room creation)
        ))

        # Increment viewer count
        room_info["viewer_count"] += 1

        return token.to_jwt()


    async def get_room_info(self, pair_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about an audio room.

        Args:
            pair_id: Stream pair identifier

        Returns:
            Room information or None if not found
        """
        room_info = self.active_rooms.get(pair_id)

        # Check if room has expired
        if room_info and datetime.utcnow() > room_info["expires_at"]:
            await self.cleanup_room(pair_id)
            return None

        return room_info

    async def mark_streamer_joined(self, pair_id: str, streamer_id: str) -> Tuple[bool, bool]:
        """
        Mark a streamer as having joined the audio room.

        Args:
            pair_id: Stream pair identifier
            streamer_id: Streamer identifier

        Returns:
            Tuple of (success, first_streamer) - True if this is the first streamer to join
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False, False

        # Check if this is the first streamer to join
        first_streamer = not (room_info["streamer_a"]["joined"] or room_info["streamer_b"]["joined"])

        if room_info["streamer_a"]["id"] == streamer_id:
            room_info["streamer_a"]["joined"] = True
            room_info["streamer_a"]["joined_at"] = datetime.utcnow()
            logger.info(f"Streamer A joined room {pair_id}")
            return True, first_streamer
        elif room_info["streamer_b"]["id"] == streamer_id:
            room_info["streamer_b"]["joined"] = True
            room_info["streamer_b"]["joined_at"] = datetime.utcnow()
            logger.info(f"Streamer B joined room {pair_id}")
            return True, first_streamer

        return False, False

    async def mark_streamer_joined_by_role(self, pair_id: str, role: str) -> Tuple[bool, bool]:
        """
        Mark a streamer as having joined based on their role.

        Args:
            pair_id: Stream pair identifier
            role: Role (streamer_a or streamer_b)

        Returns:
            Tuple of (success, first_streamer) - True if this is the first streamer to join
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False, False

        # Check if this is the first streamer to join
        first_streamer = not (room_info["streamer_a"]["joined"] or room_info["streamer_b"]["joined"])

        if role == "streamer_a":
            room_info["streamer_a"]["joined"] = True
            room_info["streamer_a"]["joined_at"] = datetime.utcnow()
            # IMPORTANT: Set the has_streamer_joined flag so viewers can join
            room_info["has_streamer_joined"] = True
            logger.info(f"Streamer A joined room {pair_id} via role")
            logger.info(f"Room {pair_id} has_streamer_joined flag set to True")
            return True, first_streamer
        elif role == "streamer_b":
            room_info["streamer_b"]["joined"] = True
            room_info["streamer_b"]["joined_at"] = datetime.utcnow()
            # IMPORTANT: Set the has_streamer_joined flag so viewers can join
            room_info["has_streamer_joined"] = True
            logger.info(f"Streamer B joined room {pair_id} via role")
            logger.info(f"Room {pair_id} has_streamer_joined flag set to True")
            return True, first_streamer

        return False, False

    async def cleanup_room(self, pair_id: str) -> bool:
        """
        Clean up and remove an audio room.

        Args:
            pair_id: Stream pair identifier

        Returns:
            True if room was removed, False if not found
        """
        if pair_id in self.active_rooms:
            room_info = self.active_rooms[pair_id]
            logger.info(f"Cleaning up audio room {pair_id} with {room_info['viewer_count']} viewers")
            del self.active_rooms[pair_id]
            return True
        return False

    async def cleanup_expired_rooms(self) -> int:
        """
        Clean up all expired audio rooms.

        Returns:
            Number of rooms cleaned up
        """
        current_time = datetime.utcnow()
        expired_pairs = [
            pair_id for pair_id, room in self.active_rooms.items()
            if current_time > room["expires_at"]
        ]

        for pair_id in expired_pairs:
            await self.cleanup_room(pair_id)

        if expired_pairs:
            logger.info(f"Cleaned up {len(expired_pairs)} expired audio rooms")

        return len(expired_pairs)

    def get_active_rooms_stats(self) -> Dict[str, Any]:
        """
        Get statistics about active audio rooms.

        Returns:
            Statistics dictionary
        """
        total_viewers = sum(room["viewer_count"] for room in self.active_rooms.values())
        rooms_with_both_streamers = sum(
            1 for room in self.active_rooms.values()
            if room["streamer_a"]["joined"] and room["streamer_b"]["joined"]
        )

        return {
            "total_rooms": len(self.active_rooms),
            "rooms_with_both_streamers": rooms_with_both_streamers,
            "total_viewers": total_viewers,
            "room_details": [
                {
                    "pair_id": pair_id,
                    "streamer_a_joined": room["streamer_a"]["joined"],
                    "streamer_b_joined": room["streamer_b"]["joined"],
                    "viewer_count": room["viewer_count"],
                    "created_at": room["created_at"].isoformat(),
                    "expires_at": room["expires_at"].isoformat()
                }
                for pair_id, room in self.active_rooms.items()
            ]
        }

    async def can_user_join_room(self, pair_id: str, user_id: str) -> bool:
        """
        Check if a user can join an audio room.

        Args:
            pair_id: Stream pair identifier
            user_id: User identifier

        Returns:
            True if user can join, False otherwise
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False

        # Check if user is one of the streamers
        return (
            room_info["streamer_a"]["id"] == user_id or
            room_info["streamer_b"]["id"] == user_id
        )

    async def add_participant(self, pair_id: str, user_id: str, username: Optional[str], role: str) -> bool:
        """
        Add a participant to the room tracking.

        Args:
            pair_id: Stream pair identifier
            user_id: User identifier
            username: Optional username
            role: User role

        Returns:
            True if successful
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False

        # Mark streamer as joined
        if role in ["streamer", "moderator"]:
            return await self.mark_streamer_joined(pair_id, user_id)

        # Increment viewer count
        if role in ["viewer", "listener"]:
            room_info["viewer_count"] += 1

        return True

    async def remove_participant(self, pair_id: str, user_id: str) -> bool:
        """
        Remove a participant from the room.

        Args:
            pair_id: Stream pair identifier
            user_id: User identifier

        Returns:
            True if successful
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False

        # Check if it's a streamer
        if room_info["streamer_a"]["id"] == user_id:
            room_info["streamer_a"]["joined"] = False
            logger.info(f"Streamer A left room {pair_id}")
        elif room_info["streamer_b"]["id"] == user_id:
            room_info["streamer_b"]["joined"] = False
            logger.info(f"Streamer B left room {pair_id}")
        else:
            # Decrement viewer count
            room_info["viewer_count"] = max(0, room_info["viewer_count"] - 1)

        return True

    async def get_room_config(self, pair_id: str) -> Dict[str, Any]:
        """
        Get room configuration.

        Args:
            pair_id: Stream pair identifier

        Returns:
            Room configuration dictionary
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return {}

        return {
            "room_name": room_info["room_name"],
            "livekit_url": self.livekit_url,
            "max_participants": 100,
            "audio_only": True,
            "echo_cancellation": True,
            "noise_suppression": True,
            "auto_gain_control": True
        }

    async def get_room_by_stream_pair(self, pair_id: str) -> Optional[str]:
        """
        Get room ID by stream pair.

        Args:
            pair_id: Stream pair identifier

        Returns:
            Room ID or None
        """
        if pair_id in self.active_rooms:
            return pair_id
        return None

    async def get_viewer_token_for_stream_pair(self, pair_id: str) -> Optional[Dict[str, Any]]:
        """
        Get viewer token and room information for a stream pair.

        Args:
            pair_id: Stream pair identifier

        Returns:
            Dictionary with token, room_id and other info, or None if room doesn't exist
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            logger.warning(f"No audio room found for pair {pair_id}")
            return None

        # Generate viewer token
        viewer_token = self.generate_viewer_token(pair_id)
        if not viewer_token:
            return None

        # Return complete room information including the actual room_id
        return {
            "success": True,
            "stream_id": pair_id,
            "room_id": room_info["room_name"],  # Return the actual LiveKit room name
            "viewer_token": viewer_token,
            "participants": await self.get_room_participants(pair_id),
            "listener_count": room_info.get("viewer_count", 0)
        }

    async def get_room_participants(self, pair_id: str) -> List[Dict[str, Any]]:
        """
        Get list of room participants.

        Args:
            pair_id: Stream pair identifier

        Returns:
            List of participant information
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return []

        participants = []

        # Add streamers if joined
        if room_info["streamer_a"]["joined"]:
            participants.append({
                "id": room_info["streamer_a"]["id"],
                "role": "streamer",
                "name": "Streamer A",
                "joined_at": room_info["streamer_a"].get("joined_at", room_info["created_at"]).isoformat()
            })

        if room_info["streamer_b"]["joined"]:
            participants.append({
                "id": room_info["streamer_b"]["id"],
                "role": "streamer",
                "name": "Streamer B",
                "joined_at": room_info["streamer_b"].get("joined_at", room_info["created_at"]).isoformat()
            })

        return participants

    async def get_listener_count(self, pair_id: str) -> int:
        """
        Get the number of listeners in a room.

        Args:
            pair_id: Stream pair identifier

        Returns:
            Number of listeners
        """
        room_info = self.active_rooms.get(pair_id)
        return room_info["viewer_count"] if room_info else 0

    async def can_user_close_room(self, pair_id: str, user_id: str) -> bool:
        """
        Check if a user can close a room.

        Args:
            pair_id: Stream pair identifier
            user_id: User identifier

        Returns:
            True if user can close the room
        """
        room_info = self.active_rooms.get(pair_id)
        if not room_info:
            return False

        # Only streamers or moderators can close rooms
        return (
            room_info["streamer_a"]["id"] == user_id or
            room_info["streamer_b"]["id"] == user_id
        )

    async def close_room(self, pair_id: str) -> bool:
        """
        Close an audio room.

        Args:
            pair_id: Stream pair identifier

        Returns:
            True if room was closed
        """
        return await self.cleanup_room(pair_id)

    async def get_room_info(self, room_id: str) -> Dict[str, Any]:
        """
        Get information about a specific room.

        Args:
            room_id: Room identifier (can be with or without audio_ prefix)

        Returns:
            Room information or None if not found
        """
        # Handle both formats: "audio_XXXXX" and just "XXXXX"
        if room_id.startswith("audio_"):
            pair_id = room_id[6:]  # Remove "audio_" prefix
        else:
            pair_id = room_id

        return self.active_rooms.get(pair_id)

    async def get_active_rooms(self) -> List[Dict[str, Any]]:
        """
        Get list of all active rooms.

        Returns:
            List of active room information
        """
        return [
            {
                "pair_id": pair_id,
                "room_name": room["room_name"],
                "streamer_a_joined": room["streamer_a"]["joined"],
                "streamer_b_joined": room["streamer_b"]["joined"],
                "viewer_count": room["viewer_count"],
                "created_at": room["created_at"].isoformat(),
                "expires_at": room["expires_at"].isoformat()
            }
            for pair_id, room in self.active_rooms.items()
        ]