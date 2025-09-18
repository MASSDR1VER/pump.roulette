"""
Audio Room Endpoints

API endpoints for wallet-authenticated audio room creation, joining, and streaming.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from services.wallet_auth_service import WalletAuthService
from services.audio_room_service import AudioRoomService
from services.pumpfun_notification_service import PumpFunNotificationService
from services.pumpfun_websocket_service import PumpFunWebSocketService
from api.v1.endpoints.auth import get_current_user, get_wallet_auth_service, verify_and_consume_nonce
from services.stream_manager_v2 import StreamManager
from models.token import Token
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory verified sessions storage (in production, use Redis)
verified_sessions: Dict[str, Dict[str, Any]] = {}


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


class RoomVerifyRequest(BaseModel):
    """Request model for room wallet verification."""
    pubkey: str = Field(..., description="Wallet public key")
    room_id: str = Field(..., description="Room/pair identifier")
    role: str = Field(..., description="Role (streamer_a or streamer_b)")
    signature: str = Field(..., description="Signed message")
    nonce: str = Field(..., description="Nonce used in message")
    token: Optional[str] = Field(None, description="LiveKit token for room recovery")


class RoomVerifyResponse(BaseModel):
    """Response model for room verification."""
    ok: bool
    verified: bool
    message: Optional[str] = None
    error: Optional[str] = None


class CreatorPublishTokenRequest(BaseModel):
    """Request model for creator publish token."""
    role: str = Field(..., description="Role (streamer_a or streamer_b)")


class CreatorPublishTokenResponse(BaseModel):
    """Response model for creator publish token."""
    publish_token: str
    expires_in: int


# Create a singleton instance of AudioRoomService
_audio_room_service = AudioRoomService()

def get_audio_room_service() -> AudioRoomService:
    """Dependency to get audio room service (singleton)."""
    return _audio_room_service


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


def get_stream_manager(request: Request) -> StreamManager:
    """
    Dependency to get the StreamManager instance.

    Args:
        request: FastAPI request object

    Returns:
        StreamManager instance
    """
    return request.app.state.stream_manager


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
        summoner_id = current_user.get('wallet_address', current_user.get('id'))
        room_data = await audio_service.create_audio_room(
            pair_id=request.stream_pair_id,
            streamer_a_id=request.streamer_a_id,
            streamer_b_id=request.streamer_b_id,
            summoner_id=summoner_id
        )

        # Generate LiveKit token for the creator as a listener/viewer
        # The creator who summons gets a viewer token to listen to the audio room
        # Use a unique viewer ID to avoid conflicts with streamers
        viewer_id = f"viewer_{current_user['wallet_address'][:8]}"
        viewer_token = audio_service.generate_viewer_token(
            room_data["pair_id"],
            viewer_id
        )

        # Send pump.fun notifications to streamers if mint addresses are provided
        if request.stream_1_mint and request.stream_2_mint:
            # Try WebSocket service first (more reliable)
            try:
                ws_service = PumpFunWebSocketService()
                ws_results = await ws_service.notify_both_streamers(
                    stream_1_mint=request.stream_1_mint,
                    stream_2_mint=request.stream_2_mint,
                    room_id=room_data["pair_id"]
                )
                logger.info(f"Pump.fun WebSocket notifications sent: {ws_results}")
            except Exception as e:
                logger.error(f"Failed to send WebSocket notifications: {e}")

                # Fallback to HTTP API if WebSocket fails
                try:
                    notification_results = await notification_service.notify_both_streamers(
                        stream_1_mint=request.stream_1_mint,
                        stream_2_mint=request.stream_2_mint,
                        room_id=room_data["pair_id"]
                    )
                    logger.info(f"Pump.fun API notifications sent: {notification_results}")
                except Exception as e2:
                    logger.error(f"Failed to send API notifications: {e2}")
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

        # Generate frontend URLs for streamers (without tokens for security)
        base_url = "https://app.pump-roulette.com"  # Production URL
        streamer_a_url = f"{base_url}/?room={room_data['pair_id']}&role=streamer_a"
        streamer_b_url = f"{base_url}/?room={room_data['pair_id']}&role=streamer_b"

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
            room_token=viewer_token,  # Return viewer token so creator can listen
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

        # IMPORTANT: Check if at least one streamer has joined
        # This ensures the LiveKit room actually exists before viewer tries to connect
        if not room_info.get("has_streamer_joined", False):
            logger.info(f"Viewer attempting to join room {room_id} but no streamer has joined yet")
            raise HTTPException(
                status_code=425,  # Too Early
                detail="Waiting for streamers to join. Please try again in a moment."
            )

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


@router.post("/room/verify")
async def room_verify(
    request: RoomVerifyRequest,
    audio_service: AudioRoomService = Depends(get_audio_room_service),
    auth_service: WalletAuthService = Depends(get_wallet_auth_service)
) -> Dict[str, Any]:
    """
    Verify a streamer's wallet and generate audio token.

    Args:
        request (RoomVerifyRequest): Verification request with wallet signature
        audio_service (AudioRoomService): Audio room service
        auth_service (WalletAuthService): Wallet authentication service

    Returns:
        Dict[str, Any]: Token and room information if verified
    """
    try:
        # Use the room_id from the request
        room_id = request.room_id

        # Get room information
        room_info = audio_service.active_rooms.get(room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Audio room not found")

        # Construct the expected message with the nonce
        expected_message = f"Verify wallet for PumpRoulette room {room_id} with nonce {request.nonce}"

        # Verify wallet signature
        is_valid = auth_service.verify_wallet_signature(
            wallet_address=request.pubkey,
            message=expected_message,
            signature=request.signature
        )

        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid wallet signature")

        # Create or get user for auto-login
        user = await User.find_one(User.wallet_address == request.pubkey)
        if not user:
            # Create new user
            user = User(
                wallet_address=request.pubkey,
                username=None,
                display_name=f"User_{request.pubkey[:8]}",
                last_login=datetime.now(timezone.utc)
            )
            await user.insert()
        else:
            # Update last login
            user.last_login = datetime.now(timezone.utc)
            await user.save()

        # Generate auth JWT token for the user
        auth_token = auth_service.create_user_token(
            wallet_address=request.pubkey,
            username=user.username
        )

        # Determine which streamer this is
        streamer_token = None
        if request.role == "streamer_a":
            # Check if wallet matches expected streamer A
            expected_id = room_info["streamer_a"]["id"]
            if request.pubkey != expected_id and not request.pubkey.startswith(expected_id[:8]):
                # For development, allow any wallet
                logger.warning(f"Wallet {request.pubkey} doesn't match expected streamer A {expected_id}")
            streamer_token = room_info["streamer_a"]["token"]
        elif request.role == "streamer_b":
            # Check if wallet matches expected streamer B
            expected_id = room_info["streamer_b"]["id"]
            if request.pubkey != expected_id and not request.pubkey.startswith(expected_id[:8]):
                # For development, allow any wallet
                logger.warning(f"Wallet {request.pubkey} doesn't match expected streamer B {expected_id}")
            streamer_token = room_info["streamer_b"]["token"]
        else:
            raise HTTPException(status_code=400, detail="Invalid role")

        if not streamer_token:
            raise HTTPException(status_code=403, detail="Not authorized for this role")

        # Mark the streamer as joined based on their role
        # Use the role to determine which streamer joined, not the pubkey
        success = False
        is_first_streamer = False

        if request.role == "streamer_a":
            # Mark streamer A as joined
            success, is_first_streamer = await audio_service.mark_streamer_joined_by_role(room_id, "streamer_a")
        elif request.role == "streamer_b":
            # Mark streamer B as joined
            success, is_first_streamer = await audio_service.mark_streamer_joined_by_role(room_id, "streamer_b")

        if success and is_first_streamer:
            # First streamer has joined - notify the summoner (viewer)
            logger.info(f"First streamer joined room {room_id}, notifying viewer")

            # Generate viewer token for the summoner
            summoner_id = room_info.get("summoner_id")
            logger.info(f"Room info - summoner_id: {summoner_id}, viewer_notified: {room_info.get('viewer_notified')}")
            if summoner_id:
                # Send WebSocket notification to the summoner
                # Import app to get websocket_manager
                from main import app
                if hasattr(app.state, 'websocket_manager'):
                    ws_manager = app.state.websocket_manager

                    # IMPORTANT: Wait a bit before generating viewer token
                    # This gives streamer time to fully connect to LiveKit and create the room
                    import asyncio
                    logger.info(f"Waiting 10 seconds for streamer to fully connect to LiveKit...")
                    await asyncio.sleep(10)

                    # Generate viewer token for auto-connect
                    viewer_token = audio_service.generate_viewer_token(
                        pair_id=room_id,
                        viewer_id=f"viewer_{summoner_id[:8]}"
                    )

                    # Check which rooms are active in WebSocket manager
                    logger.info(f"Active WebSocket rooms: {list(ws_manager.rooms.keys())}")
                    logger.info(f"Trying to broadcast to room: {room_id}")

                    # Send notification to all users in the room
                    await ws_manager.broadcast_to_room(room_id, {
                        "type": "streamer_ready",
                        "data": {
                            "room_id": room_id,
                            "streamer_joined": request.role,
                            "viewer_token": viewer_token,
                            "audio_endpoint": audio_service.livekit_url,
                            "message": "A streamer has joined! You can now connect to listen."
                        }
                    })

                    # Mark that viewer has been notified
                    room_info["viewer_notified"] = True
                    logger.info(f"Sent streamer_ready notification for room {room_id} with viewer token")

        # Convert user to dict and handle ObjectId serialization
        user_data = None
        if user:
            user_dict = user.model_dump()
            # Convert ObjectId to string
            if '_id' in user_dict:
                user_dict['_id'] = str(user_dict['_id'])
            if 'id' in user_dict:
                user_dict['id'] = str(user_dict['id'])
            user_data = user_dict

        return {
            "success": True,
            "token": streamer_token,
            "room_id": room_id,
            "audio_endpoint": audio_service.livekit_url,
            "role": request.role,
            "auth_token": auth_token,  # Add auth token for auto-login
            "user": user_data  # Include user data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Room verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


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


@router.get("/rooms/{room_id}/allowed-wallets")
async def get_allowed_wallets(
    room_id: str,
    audio_service: AudioRoomService = Depends(get_audio_room_service),
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get the allowed wallet addresses for a room.

    Args:
        room_id (str): Audio room identifier
        audio_service (AudioRoomService): Audio room service
        stream_manager (StreamManager): Stream manager service

    Returns:
        Dict[str, Any]: Allowed wallets and their roles
    """
    try:
        # Get room info
        room_info = await audio_service.get_room_info(room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Room not found")

        # Get stream pair data to find token creators
        # Room ID should match the pair_id from summon
        creators = []

        # Get streamer IDs from room info
        if "streamer_a_id" in room_info:
            creators.append({
                "role": "streamer_a",
                "pubkey": room_info["streamer_a_id"],
                "tokenMint": room_info.get("stream_1_mint", "")
            })

        if "streamer_b_id" in room_info:
            creators.append({
                "role": "streamer_b",
                "pubkey": room_info["streamer_b_id"],
                "tokenMint": room_info.get("stream_2_mint", "")
            })

        return {
            "roomId": room_id,
            "creators": creators
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get allowed wallets: {str(e)}")


@router.post("/rooms/{room_id}/verify", response_model=RoomVerifyResponse)
async def verify_room_wallet(
    room_id: str,
    request: RoomVerifyRequest,
    auth_service: WalletAuthService = Depends(get_wallet_auth_service),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> RoomVerifyResponse:
    """
    Verify wallet ownership for room participation.

    Args:
        room_id (str): Audio room identifier
        request (RoomVerifyRequest): Verification request
        auth_service (WalletAuthService): Authentication service
        audio_service (AudioRoomService): Audio room service

    Returns:
        RoomVerifyResponse: Verification result
    """
    try:
        # Verify nonce
        if not verify_and_consume_nonce(request.nonce):
            return RoomVerifyResponse(
                ok=False,
                verified=False,
                error="Invalid or expired nonce"
            )

        # Get room info
        room_info = await audio_service.get_room_info(room_id)

        # If room doesn't exist and we have a token, try to extract info from the token
        if not room_info and request.token:
            try:
                import jwt
                # Decode token without verification to get the payload
                token_data = jwt.decode(request.token, options={"verify_signature": False})

                # Extract room name and user ID from token
                room_name = token_data.get("video", {}).get("room", "")
                user_id = token_data.get("sub", "")

                # Extract pair_id from room name (format: audio_XXXXX)
                if room_name.startswith("audio_"):
                    pair_id = room_name[6:]

                    # Recreate minimal room info based on token
                    # This allows verification to proceed even after backend restart
                    # We only know the token owner's ID, not both streamers
                    room_info = {
                        "pair_id": pair_id,
                        "room_name": room_name,
                        # Don't set streamer IDs - we'll accept any valid signature
                        # This allows both streamers to join after restart
                    }

                    # Store this temporary room info in service
                    if pair_id not in audio_service.active_rooms:
                        audio_service.active_rooms[pair_id] = room_info
                        logger.info(f"Recreated room info for {pair_id} from token")
            except Exception as e:
                logger.error(f"Failed to extract room info from token: {e}")

        if not room_info:
            return RoomVerifyResponse(
                ok=False,
                verified=False,
                error="Room not found"
            )

        # Build expected message
        expected_message = (
            f"PumpRoulette Audio Verification\n"
            f"Room: {room_id}\n"
            f"Role: {request.role}\n"
            f"Nonce: {request.nonce}"
        )

        # Verify signature
        is_valid = auth_service.verify_wallet_signature(
            request.pubkey,
            expected_message,
            request.signature
        )

        if not is_valid:
            return RoomVerifyResponse(
                ok=False,
                verified=False,
                error="Invalid signature"
            )

        # Check if wallet is allowed for this role
        expected_wallet = None
        if request.role == "streamer_a":
            expected_wallet = room_info.get("streamer_a_id")
        elif request.role == "streamer_b":
            expected_wallet = room_info.get("streamer_b_id")

        # If we recreated room from token, we may not have both streamer IDs
        # In this case, accept any valid signature for the role
        if expected_wallet and expected_wallet != request.pubkey:
            return RoomVerifyResponse(
                ok=False,
                verified=False,
                error=f"Wallet not authorized for role {request.role}"
            )

        # If no expected wallet (room recreated from token), accept the wallet
        # This allows the other streamer to join after backend restart

        # Store verified session
        session_key = f"{room_id}:{request.role}:{request.pubkey}"
        verified_sessions[session_key] = {
            "verified_at": datetime.now().timestamp(),
            "expires_at": datetime.now().timestamp() + 300,  # 5 minutes
            "room_id": room_id,
            "role": request.role,
            "pubkey": request.pubkey
        }

        logger.info(f"Wallet verified: {request.pubkey} for role {request.role} in room {room_id}")

        return RoomVerifyResponse(
            ok=True,
            verified=True,
            message="Wallet verified successfully"
        )

    except Exception as e:
        logger.error(f"Verification error: {e}")
        return RoomVerifyResponse(
            ok=False,
            verified=False,
            error=str(e)
        )


@router.post("/rooms/{room_id}/creator-publish-token", response_model=CreatorPublishTokenResponse)
async def get_creator_publish_token(
    room_id: str,
    request: CreatorPublishTokenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    audio_service: AudioRoomService = Depends(get_audio_room_service)
) -> CreatorPublishTokenResponse:
    """
    Get a LiveKit publish token for verified creators.

    Args:
        room_id (str): Audio room identifier
        request (CreatorPublishTokenRequest): Token request
        current_user (Dict[str, Any]): Current authenticated user
        audio_service (AudioRoomService): Audio room service

    Returns:
        CreatorPublishTokenResponse: LiveKit publish token
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Check if user is verified for this room and role
        # Handle both formats: with and without audio_ prefix
        if room_id.startswith("audio_"):
            check_room_id = room_id
        else:
            check_room_id = f"audio_{room_id}"

        session_key = f"{check_room_id}:{request.role}:{current_user['wallet_address']}"

        if session_key not in verified_sessions:
            # Try without prefix as well
            alt_session_key = f"{room_id}:{request.role}:{current_user['wallet_address']}"
            if alt_session_key not in verified_sessions:
                raise HTTPException(status_code=403, detail="Not verified for this room")
            else:
                session_key = alt_session_key

        session = verified_sessions[session_key]

        # Check if session expired
        if session["expires_at"] < datetime.now().timestamp():
            del verified_sessions[session_key]
            raise HTTPException(status_code=403, detail="Verification expired")

        # Generate LiveKit publish token
        # Ensure room_id has audio_ prefix for LiveKit
        livekit_room_name = f"audio_{room_id}" if not room_id.startswith("audio_") else room_id

        publish_token = audio_service._generate_streamer_token(
            livekit_room_name,
            current_user["wallet_address"],
            f"Streamer {request.role[-1].upper()}"  # "Streamer A" or "Streamer B"
        )

        return CreatorPublishTokenResponse(
            publish_token=publish_token,
            expires_in=600  # 10 minutes
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate publish token: {str(e)}")


@router.get("/rooms/{room_id}/stream-data")
async def get_room_stream_data(
    room_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    audio_service: AudioRoomService = Depends(get_audio_room_service),
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get stream data for the talk page.

    Args:
        room_id (str): Audio room identifier
        current_user (Dict[str, Any]): Current authenticated user
        audio_service (AudioRoomService): Audio room service
        stream_manager (StreamManager): Stream manager service

    Returns:
        Dict[str, Any]: Stream data for display
    """
    try:
        # Get room info
        room_info = await audio_service.get_room_info(room_id)
        if not room_info:
            raise HTTPException(status_code=404, detail="Room not found")

        # Determine user role
        user_role = None
        if current_user:
            if current_user["wallet_address"] == room_info.get("streamer_a_id"):
                user_role = "streamer_a"
            elif current_user["wallet_address"] == room_info.get("streamer_b_id"):
                user_role = "streamer_b"

        # Get stream pair data
        # For now, return mock data - in production, fetch from stream_manager
        stream_data = {
            "room_id": room_id,
            "stream_1": {
                "stream_id": room_info.get("stream_1_mint", ""),
                "token_name": "Token A",
                "token_address": room_info.get("stream_1_mint", ""),
                "streamer_id": room_info.get("streamer_a_id", ""),
                "is_live": True
            },
            "stream_2": {
                "stream_id": room_info.get("stream_2_mint", ""),
                "token_name": "Token B",
                "token_address": room_info.get("stream_2_mint", ""),
                "streamer_id": room_info.get("streamer_b_id", ""),
                "is_live": True
            },
            "user_role": user_role
        }

        return stream_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stream data: {str(e)}")