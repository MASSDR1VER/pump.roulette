"""
Audio Room Endpoints

API endpoints for wallet-authenticated audio room creation, joining, and streaming.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from services.wallet_auth_service import WalletAuthService
from services.audio_room_service import AudioRoomService
from services.pumpfun_notification_service import PumpFunNotificationService
from api.v1.endpoints.auth import get_current_user, get_wallet_auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SummonStreamersRequest(BaseModel):
    """Request model for summoning streamers to audio room."""
    stream_pair_id: str = Field(..., description="Stream pair identifier")
    streamer_a_id: str = Field(..., description="First streamer's identifier")
    streamer_b_id: str = Field(..., description="Second streamer's identifier")
    stream_1_mint: Optional[str] = Field(None, description="First stream's token mint address")
    stream_2_mint: Optional[str] = Field(None, description="Second stream's token mint address")

class SummonStreamersResponse(BaseModel):
    """Response model for summoning streamers."""
    success: bool
    message: str
    room_id: str
    room_token: str
    audio_endpoint: str
    streamer_a_url: Optional[str] = None
    streamer_b_url: Optional[str] = None

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


def get_notification_service() -> PumpFunNotificationService:
    """Dependency to get notification service."""
    return PumpFunNotificationService()


@router.post("/summon", response_model=SummonStreamersResponse)
async def summon_streamers(
    request: SummonStreamersRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    auth_service: WalletAuthService = Depends(get_wallet_auth_service),
    audio_service: AudioRoomService = Depends(get_audio_room_service),
    notification_service: PumpFunNotificationService = Depends(get_notification_service),
    request_ctx: Request = None
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
            pair_id=request.stream_pair_id,
            streamer_a_id=request.streamer_a_id,
            streamer_b_id=request.streamer_b_id
        )

        # Generate LiveKit token for the creator/moderator
        # This should be a LiveKit token, not a wallet auth token
        # The creator who summons gets a moderator token to join the audio room
        moderator_token = audio_service._generate_streamer_token(
            room_data["room_name"],
            current_user["wallet_address"],
            current_user.get("display_name", current_user["wallet_address"][:8])
        )

        # Send pump.fun notifications to streamers if mint addresses are provided
        if request.stream_1_mint and request.stream_2_mint:
            try:
                notification_results = await notification_service.notify_both_streamers(
                    stream_1_mint=request.stream_1_mint,
                    stream_2_mint=request.stream_2_mint,
                    room_id=room_data["pair_id"]
                )
                logger.info(f"Pump.fun notifications sent: {notification_results}")
            except Exception as e:
                logger.error(f"Failed to send pump.fun notifications: {e}")
                # Continue even if notifications fail

        # Send WebSocket notifications to streamers if available
        if request_ctx and hasattr(request_ctx.app.state, 'websocket_manager'):
            ws_manager = request_ctx.app.state.websocket_manager
            await ws_manager.send_audio_summon(
                room_id=request.stream_pair_id,
                streamer_a_id=request.streamer_a_id,
                streamer_b_id=request.streamer_b_id,
                audio_room_id=room_data["pair_id"],
                join_url_a=room_data["streamer_a"]["join_url"],
                join_url_b=room_data["streamer_b"]["join_url"]
            )

        # Generate frontend URLs for streamers (use correct port)
        base_url = "http://localhost:3001"  # Frontend port
        streamer_a_url = f"{base_url}/?room={room_data['pair_id']}&token={room_data['streamer_a']['token']}"
        streamer_b_url = f"{base_url}/?room={room_data['pair_id']}&token={room_data['streamer_b']['token']}"

        # Log the URLs for testing
        logger.info("=" * 80)
        logger.info("🎤 AUDIO ROOM CREATED - STREAMER LINKS:")
        logger.info(f"Streamer A: {streamer_a_url}")
        logger.info(f"Streamer B: {streamer_b_url}")
        logger.info("=" * 80)

        return SummonStreamersResponse(
            success=True,
            message="Audio room created successfully. Waiting for streamers to join.",
            room_id=room_data["pair_id"],  # Use pair_id as room_id
            room_token=moderator_token,  # Return LiveKit token, not wallet auth token
            audio_endpoint=audio_service.livekit_url,  # Use configured LiveKit URL
            streamer_a_url=streamer_a_url,
            streamer_b_url=streamer_b_url
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
            # Return 404 but don't break for streamers with tokens
            # They don't need this endpoint anyway
            raise HTTPException(status_code=404, detail="No active audio room for this stream pair")

        # Get room details
        room_info = await audio_service.get_room_info(room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Audio room not found")

        # Generate LiveKit viewer token (no wallet required for listening)
        viewer_token = audio_service.generate_viewer_token(
            pair_id=pair_id,
            viewer_id=f"viewer_{datetime.now().timestamp()}"
        )

        if not viewer_token:
            raise HTTPException(status_code=404, detail="Could not generate viewer token")

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