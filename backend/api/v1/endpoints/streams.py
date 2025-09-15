"""
Stream Endpoints

API endpoints for stream management including fetching live streams,
getting random pairs, and retrieving stream metadata.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from services.stream_manager_v2 import StreamManager
from services.livekit_client import LiveKitClient

router = APIRouter()


class StreamResponse(BaseModel):
    """
    Response model for stream data.

    Attributes:
        stream_id (str): Unique stream identifier
        stream_url (str): Direct URL to the stream
        token_name (str): Name of the token being promoted
        token_address (str): Contract address of the token
        streamer_name (str): Name of the streamer
        viewer_count (int): Current number of viewers
        thumbnail_url (str): URL to the stream thumbnail
    """
    stream_id: str
    stream_url: str
    token_name: str
    token_address: str
    streamer_name: str
    viewer_count: int
    thumbnail_url: str


class StreamPairResponse(BaseModel):
    """
    Response model for a pair of streams.

    Attributes:
        room_id (str): Unique identifier for this pairing/room
        stream_1 (StreamResponse): First stream in the pair
        stream_2 (StreamResponse): Second stream in the pair
    """
    room_id: str
    stream_1: StreamResponse
    stream_2: StreamResponse


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
    limit: Optional[int] = Query(None, description="Maximum number of streams to return"),
    offset: Optional[int] = Query(0, description="Number of streams to skip")
) -> List[StreamResponse]:
    """
    Get a list of all currently live streams.

    Args:
        stream_manager (StreamManager): The stream manager service
        limit (Optional[int]): Maximum number of streams to return
        offset (int): Number of streams to skip for pagination

    Returns:
        List[StreamResponse]: List of live stream data

    Raises:
        HTTPException: If unable to fetch streams
    """
    try:
        # Check if refresh is needed
        if stream_manager.needs_refresh:
            await stream_manager.refresh_streams()

        active_streams = stream_manager.get_active_streams()

        # Apply pagination
        if offset:
            active_streams = active_streams[offset:]
        if limit:
            active_streams = active_streams[:limit]

        # Convert to response model
        return [
            StreamResponse(
                stream_id=stream.stream_id,
                stream_url=stream.stream_url,
                token_name=stream.token_name,
                token_address=stream.token_address,
                streamer_name=stream.streamer_name,
                viewer_count=stream.viewer_count,
                thumbnail_url=stream.thumbnail_url
            )
            for stream in active_streams
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch streams: {str(e)}")


@router.get("/random-pair", response_model=StreamPairResponse)
async def get_random_stream_pair(
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> StreamPairResponse:
    """
    Get a random pair of live streams for the roulette feature.

    Args:
        stream_manager (StreamManager): The stream manager service

    Returns:
        StreamPairResponse: A pair of randomly selected streams with room ID

    Raises:
        HTTPException: If insufficient streams available or pairing fails
    """
    try:
        # Get random pair
        pair = stream_manager.get_random_pair()

        if not pair:
            raise HTTPException(
                status_code=503,
                detail="Insufficient live streams available. Please try again later."
            )

        stream_1, stream_2 = pair

        # Generate room ID based on stream IDs
        room_id = f"{stream_1.stream_id}_{stream_2.stream_id}"

        return StreamPairResponse(
            room_id=room_id,
            stream_1=StreamResponse(
                stream_id=stream_1.stream_id,
                stream_url=stream_1.stream_url,
                token_name=stream_1.token_name,
                token_address=stream_1.token_address,
                streamer_name=stream_1.streamer_name,
                viewer_count=stream_1.viewer_count,
                thumbnail_url=stream_1.thumbnail_url
            ),
            stream_2=StreamResponse(
                stream_id=stream_2.stream_id,
                stream_url=stream_2.stream_url,
                token_name=stream_2.token_name,
                token_address=stream_2.token_address,
                streamer_name=stream_2.streamer_name,
                viewer_count=stream_2.viewer_count,
                thumbnail_url=stream_2.thumbnail_url
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get random pair: {str(e)}")


@router.get("/{stream_id}", response_model=StreamResponse)
async def get_stream_by_id(
    stream_id: str,
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> StreamResponse:
    """
    Get details for a specific stream by ID.

    Args:
        stream_id (str): The unique identifier of the stream
        stream_manager (StreamManager): The stream manager service

    Returns:
        StreamResponse: The stream data

    Raises:
        HTTPException: If stream not found
    """
    stream = stream_manager.get_stream_by_id(stream_id)

    if not stream:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")

    return StreamResponse(
        stream_id=stream.stream_id,
        stream_url=stream.stream_url,
        token_name=stream.token_name,
        token_address=stream.token_address,
        streamer_name=stream.streamer_name,
        viewer_count=stream.viewer_count,
        thumbnail_url=stream.thumbnail_url
    )


@router.get("/token/{token_address}", response_model=List[StreamResponse])
async def get_streams_by_token(
    token_address: str,
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> List[StreamResponse]:
    """
    Get all streams promoting a specific token.

    Args:
        token_address (str): The contract address of the token
        stream_manager (StreamManager): The stream manager service

    Returns:
        List[StreamResponse]: List of streams for the specified token
    """
    streams = stream_manager.get_streams_by_token(token_address)

    return [
        StreamResponse(
            stream_id=stream.stream_id,
            stream_url=stream.stream_url,
            token_name=stream.token_name,
            token_address=stream.token_address,
            streamer_name=stream.streamer_name,
            viewer_count=stream.viewer_count,
            thumbnail_url=stream.thumbnail_url
        )
        for stream in streams
    ]


@router.get("/stats/overview", response_model=Dict[str, Any])
async def get_stream_stats(
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, Any]:
    """
    Get statistics about current stream activity.

    Args:
        stream_manager (StreamManager): The stream manager service

    Returns:
        Dict[str, Any]: Stream statistics including counts and top tokens
    """
    return stream_manager.get_stats()


@router.post("/refresh")
async def refresh_streams(
    stream_manager: StreamManager = Depends(get_stream_manager)
) -> Dict[str, str]:
    """
    Manually trigger a refresh of the stream list.

    Args:
        stream_manager (StreamManager): The stream manager service

    Returns:
        Dict[str, str]: Confirmation message

    Raises:
        HTTPException: If refresh fails
    """
    try:
        await stream_manager.refresh_streams()
        return {"message": "Stream list refreshed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh streams: {str(e)}")


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