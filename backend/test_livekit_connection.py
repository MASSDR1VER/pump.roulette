"""
Test LiveKit connection directly
"""

import asyncio
import aiohttp
import jwt
import json
from datetime import datetime
import time

async def test_livekit_connection():
    """Test LiveKit connection with a simple API call."""

    # LiveKit credentials
    api_key = "APIpanmwXZB4DAo"
    api_secret = "NWLX5VxtJCkGj3W6a2eDXoLk8eIc9yzgdPgD53OaOb5"
    livekit_url = "wss://pump-udxzob1q.livekit.cloud"

    # Create a test token
    room_name = f"test-room-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    claims = {
        "video": {
            "roomJoin": True,
            "room": room_name,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
            "hidden": False
        },
        "metadata": '{"role":"test"}',
        "name": "Test User",
        "iss": api_key,
        "sub": "test-user",
        "exp": int(time.time()) + 3600,
        "nbf": 0,
        "iat": int(time.time())
    }

    token = jwt.encode(claims, api_secret, algorithm="HS256")

    print("=" * 80)
    print("LIVEKIT CONNECTION TEST")
    print("=" * 80)
    print(f"LiveKit URL: {livekit_url}")
    print(f"API Key: {api_key}")
    print(f"Room Name: {room_name}")
    print(f"Token (first 50 chars): {token[:50]}...")

    # Decode token to verify
    decoded = jwt.decode(token, options={"verify_signature": False})
    print(f"\nDecoded token:")
    print(json.dumps(decoded, indent=2, default=str))

    # Try to connect via WebSocket
    print("\n" + "=" * 80)
    print("Testing WebSocket connection...")
    print("=" * 80)

    ws_url = f"{livekit_url}/rtc?access_token={token}&auto_subscribe=1&sdk=python&version=test&protocol=16"

    print(f"WebSocket URL (truncated): {ws_url[:100]}...")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                ws_url,
                timeout=aiohttp.ClientTimeout(total=10),
                headers={
                    'User-Agent': 'LiveKit-Test/1.0',
                    'Origin': 'http://localhost:3001',
                }
            ) as ws:
                print("✅ WebSocket connection established!")

                # Send a simple ping
                await ws.send_str('{"type":"ping"}')

                # Wait for response
                msg = await ws.receive(timeout=5)
                if msg.type == aiohttp.WSMsgType.TEXT:
                    print(f"Received: {msg.data[:200]}")
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    print(f"WebSocket error: {msg}")

                await ws.close()

    except asyncio.TimeoutError:
        print("❌ Connection timeout - LiveKit might be rejecting the connection")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"Error type: {type(e).__name__}")

    # Test HTTP API endpoint
    print("\n" + "=" * 80)
    print("Testing LiveKit HTTP API...")
    print("=" * 80)

    # LiveKit Cloud uses HTTPS for API
    api_url = livekit_url.replace("wss://", "https://")

    # Create authorization header for API
    api_token_claims = {
        "iss": api_key,
        "sub": api_key,
        "exp": int(time.time()) + 3600,
        "nbf": 0,
        "iat": int(time.time()),
        "roomList": True,  # Permission to list rooms
    }
    api_token = jwt.encode(api_token_claims, api_secret, algorithm="HS256")

    try:
        async with aiohttp.ClientSession() as session:
            # Try to list rooms
            async with session.get(
                f"{api_url}/twirp/livekit.RoomService/ListRooms",
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
                json={}
            ) as response:
                print(f"API Response Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ API is accessible!")
                    print(f"Response: {json.dumps(data, indent=2)}")
                else:
                    text = await response.text()
                    print(f"Response: {text[:500]}")
    except Exception as e:
        print(f"❌ API request failed: {e}")

    print("\n" + "=" * 80)
    print("DIAGNOSIS:")
    print("=" * 80)
    print("If WebSocket fails but API works: CORS or WebSocket-specific issue")
    print("If both fail: Credentials or network issue")
    print("Check browser console for CORS errors")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_livekit_connection())