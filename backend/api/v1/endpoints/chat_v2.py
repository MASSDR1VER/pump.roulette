"""
Chat Endpoints V2

Improved WebSocket implementation for real-time chat.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/rooms")
async def get_active_rooms():
    """
    Get list of active chat rooms.

    Returns:
        List of active rooms with user counts and basic info
    """
    try:
        from main import app
        websocket_manager = app.state.websocket_manager

        # Get all room stats
        all_stats = websocket_manager.get_all_stats()

        return {
            "success": True,
            "rooms": all_stats.get("rooms", []),
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
            logger.info(f"Found stored stream pair for room {room_id}: {stored_pair}")
            # Convert tuple to dict format if needed
            if isinstance(stored_pair, tuple) and len(stored_pair) == 2:
                # For now, return the stored tuple as is
                # In a real implementation, you'd fetch full stream data
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
            return {
                "success": False,
                "error": "Room not found"
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
    room_id: str,
    user_id: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    stream_1: Optional[str] = Query(None),
    stream_2: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time chat.

    Simplified implementation that works correctly with FastAPI.
    """
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

        # Create stream pair tuple
        stream_pair = (stream_1 or "unknown", stream_2 or "unknown")

        # Connect to the chat room
        logger.info(f"Attempting to connect to WebSocket manager for room {room_id}")
        connection = await websocket_manager.connect(
            websocket=websocket,
            user_id=user_id,
            username=username,
            room_id=room_id,
            stream_pair=stream_pair
        )
        logger.info(f"Successfully connected to WebSocket manager")

        logger.info(f"WebSocket connected: {user_id} in room {room_id}")

        # Handle incoming messages
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_json()

                # Process message
                if data.get("type") == "message":
                    content = data.get("content", "").strip()
                    if content:
                        await websocket_manager.handle_message(user_id, content)

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