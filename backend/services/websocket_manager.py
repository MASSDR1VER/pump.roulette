"""
WebSocket Manager Service

Manages WebSocket connections for real-time chat functionality.
This service handles connection lifecycle, message broadcasting, and chat room management.
"""

import asyncio
import json
import logging
from typing import Dict, Set, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict, deque

from fastapi import WebSocket, WebSocketDisconnect
from config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    """
    Represents a chat message in a room.

    Attributes:
        id (str): Unique message identifier
        room_id (str): The chat room identifier
        user_id (str): Sender's user identifier
        username (str): Display name of the sender
        content (str): The message content
        timestamp (datetime): When the message was sent
        is_system (bool): Whether this is a system message
        profile_image (str): User's profile image URL
        reply_to (str): ID of message being replied to
        reactions (Dict): Message reactions
    """
    id: str
    room_id: str
    user_id: str
    username: str
    content: str
    timestamp: datetime
    is_system: bool = False
    profile_image: Optional[str] = None
    reply_to: Optional[str] = None
    reactions: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "room_id": self.room_id,
            "user_id": self.user_id,
            "username": self.username,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "is_system": self.is_system,
            "profile_image": self.profile_image,
            "reply_to": self.reply_to,
            "reactions": self.reactions or {"likes": 0, "users_liked": []}
        }


@dataclass
class UserConnection:
    """
    Represents a user's WebSocket connection.

    Attributes:
        websocket (WebSocket): The WebSocket connection object
        user_id (str): User's unique identifier
        username (str): User's display name
        room_id (str): Current room the user is in
        connected_at (datetime): When the user connected
        message_count (int): Number of messages sent (for rate limiting)
        last_message_time (datetime): Time of last message (for rate limiting)
        profile_image (str): User's profile image URL
    """
    websocket: WebSocket
    user_id: str
    username: str
    room_id: str
    connected_at: datetime
    message_count: int = 0
    last_message_time: Optional[datetime] = None
    profile_image: Optional[str] = None

    def __hash__(self):
        """Make UserConnection hashable by using user_id and connected_at."""
        return hash((self.user_id, self.connected_at))

    def __eq__(self, other):
        """Define equality based on user_id and connected_at."""
        if not isinstance(other, UserConnection):
            return False
        return self.user_id == other.user_id and self.connected_at == other.connected_at


class ChatRoom:
    """
    Represents a chat room for a stream pair.

    Manages the list of connected users and message history for a specific room.

    Attributes:
        room_id (str): Unique room identifier
        stream_pair (Dict or Tuple): Full stream data or IDs of the paired streams
        connections (Set[UserConnection]): Active connections in this room
        message_history (deque): Recent message history
        created_at (datetime): When the room was created
    """

    def __init__(self, room_id: str, stream_pair: Any):
        """
        Initialize a new chat room.

        Args:
            room_id (str): Unique identifier for the room
            stream_pair: Full stream data dict or tuple of stream IDs
        """
        self.room_id = room_id
        self.stream_pair = stream_pair
        self.connections: Set[UserConnection] = set()
        self.message_history = deque(maxlen=settings.MAX_CHAT_HISTORY)
        self.created_at = datetime.utcnow()

    def add_connection(self, connection: UserConnection) -> None:
        """
        Add a new connection to the room.

        Args:
            connection (UserConnection): The user connection to add
        """
        self.connections.add(connection)
        logger.info(f"User {connection.username} joined room {self.room_id}")

    def remove_connection(self, connection: UserConnection) -> None:
        """
        Remove a connection from the room.

        Args:
            connection (UserConnection): The user connection to remove
        """
        self.connections.discard(connection)
        logger.info(f"User {connection.username} left room {self.room_id}")

    def add_message(self, message: ChatMessage) -> None:
        """
        Add a message to the room's history.

        Args:
            message (ChatMessage): The message to add
        """
        self.message_history.append(message)

    def get_user_count(self) -> int:
        """
        Get the number of users in the room.

        Returns:
            int: Number of active connections
        """
        return len(self.connections)


class WebSocketManager:
    """
    Central manager for all WebSocket connections and chat rooms.

    This class handles WebSocket lifecycle, message routing, rate limiting,
    and room management for the real-time chat feature.

    Attributes:
        rooms (Dict[str, ChatRoom]): Active chat rooms by room ID
        connections (Dict[str, UserConnection]): All active connections by user ID
        room_stream_pairs (Dict[str, tuple]): Persistent room stream pairs
        message_counter (int): Counter for generating message IDs
    """

    def __init__(self):
        """Initialize the WebSocket manager with empty rooms and connections."""
        self.rooms: Dict[str, ChatRoom] = {}
        self.connections: Dict[str, UserConnection] = {}
        self.room_stream_pairs: Dict[str, Any] = {}  # Persistent room stream storage (full data)
        self.message_counter = 0
        self._lock = asyncio.Lock()

    async def cleanup(self) -> None:
        """
        Clean up all connections and rooms.

        Called during application shutdown to properly close all WebSocket connections.
        """
        logger.info("Cleaning up WebSocket connections...")

        # Close all active connections
        for connection in list(self.connections.values()):
            try:
                await connection.websocket.close()
            except Exception as e:
                logger.error(f"Error closing connection: {e}")

        self.rooms.clear()
        self.connections.clear()

        logger.info("WebSocket cleanup complete")

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        username: str,
        room_id: str,
        stream_pair: Any,
        profile_image: Optional[str] = None
    ) -> UserConnection:
        """
        Handle a new WebSocket connection.

        Args:
            websocket (WebSocket): The WebSocket connection
            user_id (str): User's unique identifier
            username (str): User's display name
            room_id (str): Room to join
            stream_pair (tuple): The stream pair for this room

        Returns:
            UserConnection: The created connection object
        """
        # Note: WebSocket is already accepted in the endpoint

        # Create user connection
        connection = UserConnection(
            websocket=websocket,
            user_id=user_id,
            username=username,
            room_id=room_id,
            connected_at=datetime.utcnow(),
            profile_image=profile_image
        )

        async with self._lock:
            # Store or retrieve stream pair for this room
            if room_id not in self.room_stream_pairs and stream_pair:
                # Handle different stream pair formats
                if isinstance(stream_pair, dict) and "stream_1" in stream_pair:
                    # Full stream data format
                    self.room_stream_pairs[room_id] = stream_pair
                    logger.info(f"Storing full stream data for room {room_id}")
                elif isinstance(stream_pair, tuple) and stream_pair != ("unknown", "unknown"):
                    # Legacy tuple format
                    self.room_stream_pairs[room_id] = stream_pair
                    logger.info(f"Storing stream pair tuple for room {room_id}: {stream_pair}")

            # Use stored stream pair if available
            room_stream_pair = self.room_stream_pairs.get(room_id, stream_pair)

            # Create room if it doesn't exist
            if room_id not in self.rooms:
                logger.info(f"Creating new room {room_id} with stream pair: {room_stream_pair}")
                self.rooms[room_id] = ChatRoom(room_id, room_stream_pair)
            else:
                logger.info(f"Joining existing room {room_id} with {len(self.rooms[room_id].connections)} users")

            # Add connection to room and global registry
            self.rooms[room_id].add_connection(connection)
            self.connections[user_id] = connection

        # Send connection confirmation
        await self._send_to_connection(connection, {
            "type": "connection",
            "status": "connected",
            "room_id": room_id,
            "user_count": self.rooms[room_id].get_user_count()
        })

        # Send recent message history
        logger.info(f"Sending message history to {user_id}, room has {len(self.rooms[room_id].message_history)} messages")
        await self._send_message_history(connection, room_id)

        # Broadcast user joined message
        await self.broadcast_system_message(
            room_id,
            f"{username} joined the chat"
        )

        logger.info(f"WebSocket connected: user={user_id}, room={room_id}")
        return connection

    async def disconnect(self, user_id: str) -> None:
        """
        Handle a WebSocket disconnection.

        Args:
            user_id (str): The disconnecting user's ID
        """
        async with self._lock:
            connection = self.connections.get(user_id)
            if not connection:
                return

            # Remove from room
            room = self.rooms.get(connection.room_id)
            if room:
                room.remove_connection(connection)

                # Broadcast user left message
                await self.broadcast_system_message(
                    connection.room_id,
                    f"{connection.username} left the chat"
                )

                # Clean up empty rooms but keep stream pair info
                if room.get_user_count() == 0:
                    # Keep the stream pair info for this room
                    if connection.room_id in self.rooms:
                        stream_pair = self.rooms[connection.room_id].stream_pair
                        # Preserve full stream data
                        if stream_pair:
                            if isinstance(stream_pair, dict) and "stream_1" in stream_pair:
                                # Full stream data
                                self.room_stream_pairs[connection.room_id] = stream_pair
                            elif stream_pair != ("unknown", "unknown"):
                                # Legacy tuple format
                                self.room_stream_pairs[connection.room_id] = stream_pair
                    del self.rooms[connection.room_id]
                    logger.info(f"Removed empty room: {connection.room_id}, keeping stream pair")

            # Remove from global registry
            del self.connections[user_id]

        logger.info(f"WebSocket disconnected: user={user_id}")

    async def handle_message(
        self,
        user_id: str,
        message_content: str,
        reply_to: Optional[str] = None
    ) -> Optional[ChatMessage]:
        """
        Process an incoming chat message.

        Args:
            user_id (str): Sender's user ID
            message_content (str): The message content
            reply_to (str): ID of message being replied to

        Returns:
            Optional[ChatMessage]: The created message or None if rejected
        """
        connection = self.connections.get(user_id)
        if not connection:
            return None

        # Rate limiting check
        if not self._check_rate_limit(connection):
            await self._send_to_connection(connection, {
                "type": "error",
                "message": "Rate limit exceeded. Please slow down."
            })
            return None

        # Message length check
        if len(message_content) > settings.WEBSOCKET_MESSAGE_LIMIT:
            await self._send_to_connection(connection, {
                "type": "error",
                "message": f"Message too long. Maximum {settings.WEBSOCKET_MESSAGE_LIMIT} characters."
            })
            return None

        # Content moderation
        if settings.ENABLE_CHAT_MODERATION:
            if not await self._moderate_content(message_content):
                await self._send_to_connection(connection, {
                    "type": "error",
                    "message": "Message contains prohibited content."
                })
                return None

        # Create message
        self.message_counter += 1
        message = ChatMessage(
            id=f"msg_{self.message_counter}",
            room_id=connection.room_id,
            user_id=user_id,
            username=connection.username,
            content=message_content,
            timestamp=datetime.utcnow(),
            profile_image=connection.profile_image,
            reply_to=reply_to
        )

        # Add to room history
        room = self.rooms.get(connection.room_id)
        if room:
            room.add_message(message)

        # Update rate limit counters
        connection.message_count += 1
        connection.last_message_time = datetime.utcnow()

        # Broadcast to room
        await self.broadcast_to_room(connection.room_id, {
            "type": "message",
            "data": message.to_dict()
        })

        return message

    async def broadcast_to_room(self, room_id: str, data: Dict[str, Any]) -> None:
        """
        Broadcast a message to all users in a room.

        Args:
            room_id (str): The room to broadcast to
            data (Dict[str, Any]): The data to send
        """
        room = self.rooms.get(room_id)
        if not room:
            return

        # Send to all connections in the room
        disconnected = []
        for connection in room.connections:
            try:
                await self._send_to_connection(connection, data)
            except Exception as e:
                logger.error(f"Error sending to connection: {e}")
                disconnected.append(connection.user_id)

        # Clean up disconnected connections
        for user_id in disconnected:
            await self.disconnect(user_id)

    async def broadcast_system_message(self, room_id: str, content: str) -> None:
        """
        Broadcast a system message to a room.

        Args:
            room_id (str): The room to broadcast to
            content (str): The system message content
        """
        self.message_counter += 1
        message = ChatMessage(
            id=f"sys_{self.message_counter}",
            room_id=room_id,
            user_id="system",
            username="System",
            content=content,
            timestamp=datetime.utcnow(),
            is_system=True
        )

        # Add to room history
        room = self.rooms.get(room_id)
        if room:
            room.add_message(message)

        await self.broadcast_to_room(room_id, {
            "type": "system",
            "data": message.to_dict()
        })

    async def send_audio_summon(
        self,
        room_id: str,
        streamer_a_id: str,
        streamer_b_id: str,
        audio_room_id: str,
        join_url_a: str,
        join_url_b: str
    ) -> None:
        """
        Send audio summon notifications to streamers.

        Args:
            room_id (str): The chat room identifier
            streamer_a_id (str): First streamer's ID
            streamer_b_id (str): Second streamer's ID
            audio_room_id (str): The audio room ID
            join_url_a (str): Join URL for streamer A
            join_url_b (str): Join URL for streamer B
        """
        # Send summon notification to all users in the room
        await self.broadcast_to_room(room_id, {
            "type": "audio_summon",
            "data": {
                "audio_room_id": audio_room_id,
                "streamers": [streamer_a_id, streamer_b_id],
                "message": "Streamers are being summoned for audio conversation!"
            }
        })

        # Send specific join URLs to each streamer if they're connected
        room = self.rooms.get(room_id)
        if room:
            for connection in room.connections:
                if connection.user_id == streamer_a_id:
                    await self._send_to_connection(connection, {
                        "type": "audio_join_request",
                        "data": {
                            "audio_room_id": audio_room_id,
                            "join_url": join_url_a,
                            "message": "You've been summoned to join the audio conversation!"
                        }
                    })
                elif connection.user_id == streamer_b_id:
                    await self._send_to_connection(connection, {
                        "type": "audio_join_request",
                        "data": {
                            "audio_room_id": audio_room_id,
                            "join_url": join_url_b,
                            "message": "You've been summoned to join the audio conversation!"
                        }
                    })

    async def _send_to_connection(
        self,
        connection: UserConnection,
        data: Dict[str, Any]
    ) -> None:
        """
        Send data to a specific connection.

        Args:
            connection (UserConnection): The connection to send to
            data (Dict[str, Any]): The data to send
        """
        await connection.websocket.send_json(data)

    async def _send_message_history(
        self,
        connection: UserConnection,
        room_id: str
    ) -> None:
        """
        Send recent message history to a newly connected user.

        Args:
            connection (UserConnection): The connection to send to
            room_id (str): The room ID
        """
        room = self.rooms.get(room_id)
        if not room or not room.message_history:
            return

        history = [msg.to_dict() for msg in room.message_history]
        await self._send_to_connection(connection, {
            "type": "history",
            "data": history
        })

    def _check_rate_limit(self, connection: UserConnection) -> bool:
        """
        Check if a user has exceeded the rate limit.

        Args:
            connection (UserConnection): The connection to check

        Returns:
            bool: True if within limits, False if exceeded
        """
        if not settings.RATE_LIMIT_ENABLED:
            return True

        if not connection.last_message_time:
            return True

        # Reset counter if outside the rate limit window
        time_since_last = datetime.utcnow() - connection.last_message_time
        if time_since_last > timedelta(minutes=1):
            connection.message_count = 0
            return True

        return connection.message_count < settings.WEBSOCKET_RATE_LIMIT

    async def _moderate_content(self, content: str) -> bool:
        """
        Check if message content passes moderation rules.

        Args:
            content (str): The message content to check

        Returns:
            bool: True if content is acceptable, False otherwise
        """
        # Basic moderation - can be extended with more sophisticated checks
        content_lower = content.lower()

        # Check for blocked words (would load from file in production)
        blocked_words = ["spam", "scam", "phishing"]  # Example list
        for word in blocked_words:
            if word in content_lower:
                return False

        return True

    def get_room_stats(self, room_id: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics for a specific room.

        Args:
            room_id (str): The room ID

        Returns:
            Optional[Dict[str, Any]]: Room statistics or None if room doesn't exist
        """
        room = self.rooms.get(room_id)
        if not room:
            return None

        return {
            "room_id": room_id,
            "user_count": room.get_user_count(),
            "message_count": len(room.message_history),
            "created_at": room.created_at.isoformat(),
            "stream_pair": room.stream_pair
        }

    def get_all_stats(self) -> Dict[str, Any]:
        """
        Get global WebSocket statistics.

        Returns:
            Dict[str, Any]: Global statistics
        """
        total_users = len(self.connections)
        total_rooms = len(self.rooms)
        total_messages = sum(len(r.message_history) for r in self.rooms.values())

        return {
            "total_users": total_users,
            "total_rooms": total_rooms,
            "total_messages": total_messages,
            "rooms": [self.get_room_stats(rid) for rid in self.rooms.keys()]
        }