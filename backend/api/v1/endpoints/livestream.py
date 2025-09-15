"""
Livestream Endpoints

API endpoints for fetching livestream information from Pump.fun.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import aiohttp
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/info/{token_mint}")
async def get_livestream_info(token_mint: str) -> Dict[str, Any]:
    """
    Get livestream information for a token.

    Args:
        token_mint: Token mint address

    Returns:
        Livestream information including stream ID
    """
    url = f"https://livestream-api.pump.fun/livestream?mintId={token_mint}"

    headers = {
        'accept': 'application/json',
        'origin': 'https://pump.fun',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()

                    # Generate JWT token if stream is live
                    if data.get('isLive'):
                        from services.livekit_client import LiveKitClient
                        client = LiveKitClient()

                        stream_id = str(data['id'])
                        access_token = client.generate_access_token(
                            token_mint=token_mint,
                            stream_id=stream_id
                        )

                        data['access_token'] = access_token
                        data['room_id'] = f"{token_mint}:{stream_id}"
                        data['livekit_url'] = client.LIVEKIT_URL

                    return data
                elif response.status == 404:
                    raise HTTPException(status_code=404, detail="Stream not found")
                else:
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to fetch stream info"
                    )
    except aiohttp.ClientError as e:
        logger.error(f"Error fetching livestream info: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to livestream API")


@router.get("/test-token/{token_mint}/{stream_id}")
async def test_jwt_token(token_mint: str, stream_id: str) -> Dict[str, Any]:
    """
    Test JWT token generation for debugging.

    Args:
        token_mint: Token mint address
        stream_id: Stream ID

    Returns:
        Generated JWT token and decoded payload
    """
    from services.livekit_client import LiveKitClient

    client = LiveKitClient()

    # Generate token
    access_token = client.generate_access_token(
        token_mint=token_mint,
        stream_id=stream_id
    )

    # Decode to show payload
    decoded = client.decode_token(access_token)

    return {
        "access_token": access_token,
        "decoded_payload": decoded,
        "room_id": f"{token_mint}:{stream_id}",
        "websocket_url": client.get_stream_connection_url(token_mint, stream_id)
    }