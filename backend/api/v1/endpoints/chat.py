"""
Chat Endpoints

WebSocket and REST API endpoints for real-time chat functionality.
Handles WebSocket connections, message history, and chat room management.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request, Query
from starlette.websockets import WebSocketState
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import uuid
import logging

from services.websocket_manager import WebSocketManager

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatHistoryResponse(BaseModel):
    """
    Response model for chat history.

    Attributes:
        room_id (str): The room identifier
        messages (List[Dict]): List of messages in the room
        user_count (int): Current number of users in the room
    """
    room_id: str
    messages: List[Dict[str, Any]]
    user_count: int


def get_websocket_manager(request: Request) -> WebSocketManager:
    """
    Dependency to get the WebSocketManager instance.

    Args:
        request (Request): The FastAPI request object

    Returns:
        WebSocketManager: The application's WebSocket manager instance
    """
    return request.app.state.websocket_manager


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    user_id: Optional[str] = Query(None, description="User ID for authenticated users"),
    username: Optional[str] = Query(None, description="Username for display"),
    stream_1: Optional[str] = Query(None, description="First stream ID"),
    stream_2: Optional[str] = Query(None, description="Second stream ID")
):
    """
    WebSocket endpoint for real-time chat.

    This endpoint handles WebSocket connections for chat rooms. Each room corresponds
    to a pair of streams. Users can send and receive messages in real-time.

    Args:
        websocket (WebSocket): The WebSocket connection
        room_id (str): The chat room identifier
        user_id (Optional[str]): User ID for authenticated users
        username (Optional[str]): Display name for the user
        stream_1 (Optional[str]): First stream in the pair
        stream_2 (Optional[str]): Second stream in the pair

    The WebSocket protocol:
        - Incoming messages: {"type": "message", "content": "message text"}
        - Outgoing messages: {"type": "message", "data": {...}}
        - System messages: {"type": "system", "data": {...}}
        - Error messages: {"type": "error", "message": "error description"}
    """
    # Get WebSocket manager from app state
    # Need to get it from the Request object, not the WebSocket
    from main import app
    websocket_manager = app.state.websocket_manager

    # Generate user ID if not provided (guest user)
    if not user_id:
        user_id = f"guest_{uuid.uuid4().hex[:8]}"

    # Use default username if not provided
    if not username:
        username = f"User_{user_id[:8]}"

    # Create stream pair tuple
    stream_pair = (stream_1, stream_2) if stream_1 and stream_2 else ("unknown", "unknown")

    try:
        # Connect to the chat room
        connection = await websocket_manager.connect(
            websocket=websocket,
            user_id=user_id,
            username=username,
            room_id=room_id,
            stream_pair=stream_pair
        )

        logger.info(f"WebSocket connection established: {user_id} in room {room_id}")

        # Handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_json()

                # Process different message types
                if data.get("type") == "message":
                    content = data.get("content", "").strip()
                    if content:
                        await websocket_manager.handle_message(user_id, content)

                elif data.get("type") == "ping":
                    # Respond to ping with pong
                    await websocket.send_json({"type": "pong"})

                elif data.get("type") == "typing":
                    # Handle typing indicator (optional feature)
                    pass

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {user_id}")
                break
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Failed to process message"
                })

    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        try:
            await websocket.close()
        except:
            pass
    finally:
        # Clean up on disconnect
        await websocket_manager.disconnect(user_id)


@router.get("/room/{room_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    room_id: str,
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    limit: int = Query(50, description="Maximum number of messages to return")
) -> ChatHistoryResponse:
    """
    Get chat history for a specific room.

    Args:
        room_id (str): The room identifier
        websocket_manager (WebSocketManager): The WebSocket manager service
        limit (int): Maximum number of messages to return

    Returns:
        ChatHistoryResponse: Chat history and room information

    Raises:
        HTTPException: If room doesn't exist
    """
    room = websocket_manager.rooms.get(room_id)

    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found")

    # Get recent messages
    messages = [
        msg.to_dict() for msg in list(room.message_history)[-limit:]
    ]

    return ChatHistoryResponse(
        room_id=room_id,
        messages=messages,
        user_count=room.get_user_count()
    )


@router.get("/room/{room_id}/stats", response_model=Dict[str, Any])
async def get_room_stats(
    room_id: str,
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
) -> Dict[str, Any]:
    """
    Get statistics for a specific chat room.

    Args:
        room_id (str): The room identifier
        websocket_manager (WebSocketManager): The WebSocket manager service

    Returns:
        Dict[str, Any]: Room statistics

    Raises:
        HTTPException: If room doesn't exist
    """
    stats = websocket_manager.get_room_stats(room_id)

    if not stats:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found")

    return stats


@router.get("/stats", response_model=Dict[str, Any])
async def get_chat_stats(
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
) -> Dict[str, Any]:
    """
    Get global chat statistics.

    Args:
        websocket_manager (WebSocketManager): The WebSocket manager service

    Returns:
        Dict[str, Any]: Global chat statistics including active rooms and users
    """
    return websocket_manager.get_all_stats()


@router.delete("/room/{room_id}")
async def clear_room(
    room_id: str,
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
) -> Dict[str, str]:
    """
    Clear a chat room (admin endpoint).

    This endpoint can be used to clear a room's history and disconnect all users.
    Should be protected with authentication in production.

    Args:
        room_id (str): The room identifier
        websocket_manager (WebSocketManager): The WebSocket manager service

    Returns:
        Dict[str, str]: Confirmation message

    Raises:
        HTTPException: If room doesn't exist
    """
    room = websocket_manager.rooms.get(room_id)

    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found")

    # Broadcast system message about room closure
    await websocket_manager.broadcast_system_message(
        room_id,
        "This chat room is being closed by an administrator."
    )

    # Disconnect all users in the room
    for connection in list(room.connections):
        await websocket_manager.disconnect(connection.user_id)

    return {"message": f"Room {room_id} cleared successfully"}