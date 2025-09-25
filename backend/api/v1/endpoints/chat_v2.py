"""
Chat Endpoints V2

Improved WebSocket implementation for real-time chat.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from typing import Optional, Dict, Any
from pydantic import BaseModel
import uuid
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class RoomCreationRequest(BaseModel):
    """Request model for creating a room with stream data."""
    room_id: str
    stream_1: Dict[str, Any]
    stream_2: Dict[str, Any]


@router.post("/room/create")
async def create_room_with_streams(request: RoomCreationRequest):
    """
    Create or update a room with full stream data.

    This endpoint stores the complete stream data for a room,
    ensuring all users in the room see the same streams.
    """
    try:
        from main import app
        websocket_manager = app.state.websocket_manager

        # Store the full stream data for this room
        stream_pair = {
            "room_id": request.room_id,
            "stream_1": request.stream_1,
            "stream_2": request.stream_2
        }

        # Store in the persistent room stream pairs
        websocket_manager.room_stream_pairs[request.room_id] = stream_pair

        logger.info(f"Created/updated room {request.room_id} with full stream data")

        return {
            "success": True,
            "room_id": request.room_id,
            "message": "Room created with stream data",
            "stream_pair": stream_pair
        }

    except Exception as e:
        logger.error(f"Failed to create room: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/rooms")
async def get_active_rooms():
    """
    Get list of active chat rooms with full stream data.

    Returns:
        List of active rooms with user counts and full stream info
    """
    try:
        from main import app
        websocket_manager = app.state.websocket_manager

        # Get all room stats
        all_stats = websocket_manager.get_all_stats()
        print(f"all stats: {all_stats}")

        # Enhance room data with full stream information
        enhanced_rooms = []
        for room in all_stats.get("rooms", []):
            if room:
                room_id = room.get("room_id")

                # Try to get full stream data from persistent storage
                if room_id and room_id in websocket_manager.room_stream_pairs:
                    stored_pair = websocket_manager.room_stream_pairs[room_id]

                    # If we have full stream data, use it
                    if isinstance(stored_pair, dict) and "stream_1" in stored_pair and "stream_2" in stored_pair:
                        room["stream_pair"] = stored_pair
                        logger.info(f"Using full stream data for room {room_id}")
                    # If it's a tuple, convert to basic format
                    elif isinstance(stored_pair, tuple) and len(stored_pair) == 2:
                        room["stream_pair"] = {
                            "stream_1": {"token_address": stored_pair[0]},
                            "stream_2": {"token_address": stored_pair[1]}
                        }

                # If stream_pair exists in room data
                elif room.get("stream_pair"):
                    # If it's already full data (dict with stream_1/stream_2), use as is
                    if isinstance(room["stream_pair"], dict) and "stream_1" in room["stream_pair"]:
                        # Already has full data, keep it
                        pass
                    # If it's a tuple (token addresses), convert to basic format
                    elif isinstance(room["stream_pair"], (list, tuple)):
                        room["stream_pair"] = {
                            "stream_1": {"token_address": room["stream_pair"][0] if len(room["stream_pair"]) > 0 else None},
                            "stream_2": {"token_address": room["stream_pair"][1] if len(room["stream_pair"]) > 1 else None}
                        }

                enhanced_rooms.append(room)

        return {
            "success": True,
            "rooms": enhanced_rooms,
            "total_users": all_stats.get("total_users", 0),
            "total_rooms": all_stats.get("total_rooms", 0)
        }

    except Exception as e:
        logger.error(f"Failed to get room list: {e}")
        return {
            "success": False,
            "rooms": [],
            "error": str(e)
        }


@router.get("/room/{room_id}/info")
async def get_room_info(room_id: str):
    """
    Get detailed room information including stream pair data.

    Returns:
        Room info with stream pair details if available
    """
    try:
        from main import app
        websocket_manager = app.state.websocket_manager
        stream_manager = app.state.stream_manager

        # Get room stats (if room is active)
        room_stats = websocket_manager.get_room_stats(room_id)

        # Try to get stream pair from persistent storage first, then active pairs
        stream_pair = None

        # Check persistent room stream pairs first
        if room_id in websocket_manager.room_stream_pairs:
            stored_pair = websocket_manager.room_stream_pairs[room_id]
            logger.info(f"Found stored stream pair for room {room_id}")
            # Use the stored data directly if it's already full stream data
            if isinstance(stored_pair, dict) and "stream_1" in stored_pair:
                stream_pair = stored_pair
            elif isinstance(stored_pair, tuple) and len(stored_pair) == 2:
                # Legacy tuple format - convert to basic dict
                stream_pair = {"stream_1": {"token_address": stored_pair[0]}, "stream_2": {"token_address": stored_pair[1]}}

        # Fallback: check active stream pairs
        if not stream_pair:
            try:
                active_pairs = await stream_manager.get_active_stream_pairs()
                for pair in active_pairs:
                    if pair.get("room_id") == room_id:
                        stream_pair = pair
                        break
            except Exception as e:
                logger.warning(f"Could not fetch stream pair for room {room_id}: {e}")

        # Return info based on room availability
        if room_stats:
            # Room is currently active
            return {
                "success": True,
                "room_id": room_id,
                "user_count": room_stats["user_count"],
                "message_count": room_stats["message_count"],
                "created_at": room_stats["created_at"],
                "stream_pair": stream_pair,
                "room_active": True
            }
        elif stream_pair:
            # Room not active but has stored stream pair
            return {
                "success": True,
                "room_id": room_id,
                "user_count": 0,
                "message_count": 0,
                "created_at": None,
                "stream_pair": stream_pair,
                "room_active": False
            }
        else:
            # Room doesn't exist and no stream pair
            # This is fine - room will be created when first user joins
            return {
                "success": True,
                "room_id": room_id,
                "user_count": 0,
                "message_count": 0,
                "created_at": None,
                "stream_pair": None,
                "room_active": False,
                "message": "Room will be created when first user joins"
            }

    except Exception as e:
        logger.error(f"Failed to get room info: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str
):
    """
    WebSocket endpoint for real-time chat.

    Simplified implementation that works correctly with FastAPI.
    """
    # Get query parameters from WebSocket scope
    query_params = websocket.scope.get('query_string', b'').decode('utf-8')
    logger.info(f"Raw query string: {query_params}")

    # Parse query parameters manually
    from urllib.parse import parse_qs
    params = parse_qs(query_params)

    # Extract parameters
    user_id = params.get('user_id', [None])[0]
    username = params.get('username', [None])[0]
    profile_image = params.get('profile_image', [None])[0]
    bio = params.get('bio', [None])[0]
    stream_1 = params.get('stream_1', [None])[0]
    stream_2 = params.get('stream_2', [None])[0]

    # Log all query parameters for debugging
    logger.info(f"WebSocket connection request - room: {room_id}")
    logger.info(f"Query params - user_id: {user_id}, username: {username}, profile_image: {profile_image}")
    logger.info(f"Stream params - stream_1: {stream_1}, stream_2: {stream_2}")

    # Accept the WebSocket connection
    await websocket.accept()
    logger.info(f"WebSocket accepted for room {room_id}, user: {user_id}, username: {username}")

    # Generate user info if not provided
    if not user_id:
        user_id = f"guest_{uuid.uuid4().hex[:8]}"
    if not username:
        username = f"Guest_{user_id[:8]}"

    logger.info(f"Processed user info - user_id: {user_id}, username: {username}, streams: {stream_1}, {stream_2}")

    # Get WebSocket manager from the request
    try:
        from fastapi import Request
        from starlette.requests import Request as StarletteRequest

        # Get the app from the request scope
        scope = websocket.scope
        app = scope["app"]
        websocket_manager = app.state.websocket_manager
        logger.info(f"Got websocket_manager instance: {websocket_manager is not None}")

        # Try to get full stream data if we have room_id
        stream_pair = None
        if stream_1 and stream_2 and stream_1 != "unknown" and stream_2 != "unknown":
            # We have token addresses, but we should try to get full stream data
            # For now, we'll pass the tuple, but ideally we'd fetch full stream data here
            stream_pair = (stream_1, stream_2)
        else:
            # No stream data provided, will use what's stored in websocket manager
            stream_pair = None

        # Generate default profile image if not provided
        if not profile_image:
            # Create a default avatar using UI Avatars service
            profile_image = f"https://ui-avatars.com/api/?name={username}&background=666&color=fff&size=64&rounded=true"

        # Connect to the chat room
        logger.info(f"Attempting to connect to WebSocket manager for room {room_id}")
        try:
            connection = await websocket_manager.connect(
                websocket=websocket,
                user_id=user_id,
                username=username,
                room_id=room_id,
                stream_pair=stream_pair,
                profile_image=profile_image,
                bio=bio
            )
            logger.info(f"Successfully connected to WebSocket manager")
        except Exception as conn_err:
            logger.error(f"Failed to connect to WebSocket manager: {conn_err}")
            import traceback
            logger.error(f"Connection traceback: {traceback.format_exc()}")
            raise

        logger.info(f"WebSocket connected: {user_id} in room {room_id}")

        # Handle incoming messages
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_json()

                # Process message
                if data.get("type") == "message":
                    content = data.get("content", "").strip()
                    reply_to = data.get("reply_to")
                    logger.info(f"Received message from {user_id}: {content[:50]}...")
                    if content:
                        result = await websocket_manager.handle_message(user_id, content, reply_to=reply_to)
                        logger.info(f"Message handling result: {result is not None}")

                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {user_id}")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")

    except Exception as e:
        logger.error(f"Failed to setup WebSocket: {e}")
        import traceback
        logger.error(f"WebSocket setup traceback: {traceback.format_exc()}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
    finally:
        # Clean up on disconnect
        try:
            await websocket_manager.disconnect(user_id)
        except:
            pass