"""
Stream Endpoints V2

API endpoints for Pump.fun stream management with real data.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Dict, Any, Optional

from services.stream_manager_v2 import StreamManager
from services.livekit_client import LiveKitClient

router = APIRouter()


def get_stream_manager(request: Request) -> StreamManager:
    """
    Dependency to get the StreamManager instance.

    Args:
        request (Request): The FastAPI request object

    Returns:
        StreamManager: The application's stream manager instance
    """
    return request.app.state.stream_manager


@router.get("/live")
async def get_live_streams(
    stream_manager: StreamManager = Depends(get_stream_manager),
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get a list of all currently live token streams from Pump.fun.

    Args:
        stream_manager (StreamManager): The stream manager service
        limit (int): Maximum number of streams to return

    Returns:
        List[Dict[str, Any]]: List of live stream data
    """
    try:
        streams = await stream_manager.get_active_streams(limit=limit)
        return streams
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch streams: {str(e)}")


@router.get("/random-pair")
async def get_random_stream_pair(
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get a random pair of live Pump.fun token streams.

    Args:
        stream_manager (StreamManager): The stream manager service

    Returns:
        Dict[str, Any]: A pair of randomly selected streams with room ID
    """
    try:
        pair = await stream_manager.get_random_pair()

        if not pair:
            raise HTTPException(
                status_code=503,
                detail="Insufficient live streams available. Please try again later."
            )

        return pair

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get random pair: {str(e)}")


@router.get("/token/{mint}")
async def get_stream_by_mint(
    mint: str,
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get stream details for a specific token by mint address.

    Args:
        mint (str): The token's Solana mint address
        stream_manager (StreamManager): The stream manager service

    Returns:
        Dict[str, Any]: The stream data

    Raises:
        HTTPException: If stream not found
    """
    stream = await stream_manager.get_stream_by_mint(mint)

    if not stream:
        raise HTTPException(status_code=404, detail=f"Stream for token {mint} not found")

    return stream


@router.get("/stats")
async def get_stream_stats(
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get statistics about current stream activity.

    Args:
        stream_manager (StreamManager): The stream manager service

    Returns:
        Dict[str, Any]: Stream statistics
    """
    return stream_manager.get_stats()


@router.get("/access-token/{mint_id}")
async def get_stream_access_token(mint_id: str) -> Dict[str, Any]:
    """
    Get a new access token for a specific stream.
    Each user should get their own token to allow multiple viewers.

    Args:
        mint_id (str): The token mint address (token_address)

    Returns:
        Dict containing access token and room info

    Raises:
        HTTPException: If unable to get access token
    """
    try:
        livekit_client = LiveKitClient()

        # Get access token from Pump.fun
        access_token = await livekit_client.get_access_token_from_pump(mint_id)

        if not access_token:
            raise HTTPException(
                status_code=404,
                detail=f"Could not get access token for stream {mint_id}. Stream may not be live."
            )

        # Parse the token to get room ID
        # The room ID is usually in format "livestream:{mint_id}:{number}"
        room_id = f"livestream:{mint_id}"

        return {
            "success": True,
            "access_token": access_token,
            "room_id": room_id,
            "mint_id": mint_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get access token: {str(e)}"
        )