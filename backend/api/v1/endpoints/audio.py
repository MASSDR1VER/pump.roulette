"""
Audio Room Endpoints

API endpoints for wallet-authenticated audio room creation, joining, and streaming.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Dict, Any, List
from datetime import datetime
import logging

from services.wallet_auth_service import WalletAuthService
from services.audio_room_service import AudioRoomService
from api.v1.endpoints.auth import get_current_user, get_wallet_auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SummonStreamersRequest(BaseModel):
    """Request model for summoning streamers to audio room."""
    stream_pair_id: str = Field(..., description="Stream pair identifier")

class SummonStreamersResponse(BaseModel):
    """Response model for summoning streamers."""
    success: bool
    message: str
    room_id: str
    room_token: str
    audio_endpoint: str

class JoinAudioRoomRequest(BaseModel):
    """Request model for joining audio room."""
    room_id: str = Field(..., description="Audio room identifier")
    role: str = Field(default="participant", description="Role in the room")

class JoinAudioRoomResponse(BaseModel):
    """Response model for joining audio room."""
    success: bool
    message: str
    access_token: str
    room_config: Dict[str, Any]

class AudioStreamResponse(BaseModel):
    """Response model for audio stream details."""
    success: bool
    stream_id: str
    viewer_token: str
    participants: List[Dict[str, Any]]
    listener_count: int

class LeaveAudioRoomResponse(BaseModel):
    """Response model for leaving audio room."""
    success: bool
    message: str


def get_audio_room_service() -> AudioRoomService:
    """Dependency to get audio room service."""
    return AudioRoomService()


def get_audio_service(request: Request):
    """
    Dependency to get the AudioRoomService instance.

    Args:
        request: FastAPI request object

    Returns:
        AudioRoomService instance
    """
    return request.app.state.audio_room_service


@router.post("/summon", response_model=SummonStreamersResponse)
async def summon_streamers(
    request: SummonStreamersRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    auth_service: WalletAuthService = Depends(get_wallet_auth_service),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> SummonStreamersResponse:
    """
    Summon streamers to join an audio room.

    Args:
        request (SummonStreamersRequest): Summon request
        current_user (Dict[str, Any]): Current authenticated user
        auth_service (WalletAuthService): Authentication service
        audio_service (AudioRoomService): Audio room service

    Returns:
        SummonStreamersResponse: Audio room details and access token
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Create audio room for the stream pair
        room_data = await audio_service.create_audio_room(
            stream_pair_id=request.stream_pair_id,
            creator_wallet=current_user["wallet_address"],
            creator_username=current_user.get("username")
        )

        # Generate room token for the creator
        room_token = auth_service.create_audio_room_token(
            current_user["wallet_address"],
            room_data["room_id"],
            role="moderator"
        )

        return SummonStreamersResponse(
            success=True,
            message="Audio room created successfully. Waiting for streamers to join.",
            room_id=room_data["room_id"],
            room_token=room_token,
            audio_endpoint=room_data["audio_endpoint"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create audio room: {str(e)}")


@router.post("/join", response_model=JoinAudioRoomResponse)
async def join_audio_room(
    request: JoinAudioRoomRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    auth_service: WalletAuthService = Depends(get_wallet_auth_service),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> JoinAudioRoomResponse:
    """
    Join an audio room as a streamer.

    Args:
        request (JoinAudioRoomRequest): Join request
        current_user (Dict[str, Any]): Current authenticated user
        auth_service (WalletAuthService): Authentication service
        audio_service (AudioRoomService): Audio room service

    Returns:
        JoinAudioRoomResponse: Access token and room configuration
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Verify room exists and get room details
        room_info = await audio_service.get_room_info(request.room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Audio room not found")

        # Check if user is authorized to join (must be one of the streamers)
        if not await audio_service.can_user_join_room(
            request.room_id,
            current_user["wallet_address"]
        ):
            raise HTTPException(status_code=403, detail="Not authorized to join this room")

        # Add user to room
        await audio_service.add_participant(
            request.room_id,
            current_user["wallet_address"],
            current_user.get("username"),
            request.role
        )

        # Generate access token
        access_token = auth_service.create_audio_room_token(
            current_user["wallet_address"],
            request.room_id,
            role=request.role
        )

        # Get room configuration
        room_config = await audio_service.get_room_config(request.room_id)

        return JoinAudioRoomResponse(
            success=True,
            message="Successfully joined audio room",
            access_token=access_token,
            room_config=room_config
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to join audio room: {str(e)}")


@router.get("/stream/{pair_id}", response_model=AudioStreamResponse)
async def get_audio_stream(
    pair_id: str,
    auth_service: WalletAuthService = Depends(get_wallet_auth_service),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> AudioStreamResponse:
    """
    Get audio stream details for viewers.

    Args:
        pair_id (str): Stream pair identifier
        auth_service (WalletAuthService): Authentication service
        audio_service (AudioRoomService): Audio room service

    Returns:
        AudioStreamResponse: Stream details and viewer token
    """
    try:
        # Get active audio room for stream pair
        room_id = await audio_service.get_room_by_stream_pair(pair_id)
        if not room_id:
            raise HTTPException(status_code=404, detail="No active audio room for this stream pair")

        # Get room details
        room_info = await audio_service.get_room_info(room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Audio room not found")

        # Generate viewer token (no wallet required for listening)
        viewer_token = auth_service.create_audio_room_token(
            f"viewer_{datetime.now().timestamp()}",
            room_id,
            role="listener"
        )

        # Get participants and listener count
        participants = await audio_service.get_room_participants(room_id)
        listener_count = await audio_service.get_listener_count(room_id)

        return AudioStreamResponse(
            success=True,
            stream_id=pair_id,
            viewer_token=viewer_token,
            participants=participants,
            listener_count=listener_count
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audio stream: {str(e)}")


@router.post("/leave", response_model=LeaveAudioRoomResponse)
async def leave_audio_room(
    room_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> LeaveAudioRoomResponse:
    """
    Leave an audio room.

    Args:
        room_id (str): Audio room identifier
        current_user (Dict[str, Any]): Current authenticated user
        audio_service (AudioRoomService): Audio room service

    Returns:
        LeaveAudioRoomResponse: Success message
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Remove user from room
        await audio_service.remove_participant(
            room_id,
            current_user["wallet_address"]
        )

        return LeaveAudioRoomResponse(
            success=True,
            message="Successfully left audio room"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to leave audio room: {str(e)}")


@router.get("/rooms/active")
async def get_active_rooms(
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> Dict[str, Any]:
    """
    Get list of active audio rooms.

    Args:
        audio_service (AudioRoomService): Audio room service

    Returns:
        Dict[str, Any]: List of active rooms
    """
    try:
        active_rooms = await audio_service.get_active_rooms()
        return {
            "success": True,
            "rooms": active_rooms,
            "count": len(active_rooms)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active rooms: {str(e)}")


@router.delete("/rooms/{room_id}")
async def close_audio_room(
    room_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> Dict[str, Any]:
    """
    Close an audio room (moderator only).

    Args:
        room_id (str): Audio room identifier
        current_user (Dict[str, Any]): Current authenticated user
        audio_service (AudioRoomService): Audio room service

    Returns:
        Dict[str, Any]: Success message
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Check if user has permission to close room
        can_close = await audio_service.can_user_close_room(
            room_id,
            current_user["wallet_address"]
        )
        if not can_close:
            raise HTTPException(status_code=403, detail="Not authorized to close this room")

        # Close the room
        await audio_service.close_room(room_id)

        return {
            "success": True,
            "message": "Audio room closed successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close audio room: {str(e)}")


# Legacy endpoint for old audio room service compatibility
def get_audio_service(request: Request):
    """
    Dependency to get the AudioRoomService instance for legacy compatibility.

    Args:
        request: FastAPI request object

    Returns:
        AudioRoomService instance
    """
    return request.app.state.audio_room_service