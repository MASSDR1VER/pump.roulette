#!/usr/bin/env python3

import asyncio
import websockets
import json
from urllib.parse import urlencode

async def test_livekit_connection():
    """Test direct WebSocket connection to LiveKit"""

    # Use the new token with correct credentials
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiVmlld2VyIDg2NjQiLCJtZXRhZGF0YSI6IntcInJvbGVcIjpcInZpZXdlclwiLFwiZGlzcGxheV9uYW1lXCI6XCJWaWV3ZXIgODY2NFwifSIsInZpZGVvIjp7InJvb21Kb2luIjp0cnVlLCJyb29tIjoiYXVkaW9fSFdqdnBKam1fQkhBYVpHWjciLCJjYW5QdWJsaXNoIjpmYWxzZSwiY2FuU3Vic2NyaWJlIjp0cnVlLCJjYW5QdWJsaXNoRGF0YSI6dHJ1ZX0sInN1YiI6InZpZXdlcl8xNzU4MTY2MTQ3LjQ5ODY2NCIsImlzcyI6IkFQSXBhbm13WFpCNERBbyIsIm5iZiI6MTc1ODE2NjE0NywiZXhwIjoxNzU4MTg3NzQ3fQ.KxxigPCDJajR0uKWZy0zxYnOCssKBeGG3m2mE90QfzY"

    # LiveKit WebSocket URL
    base_url = "wss://pump-udxzob1q.livekit.cloud/rtc"

    # Add token as query parameter
    params = {
        'access_token': token,
        'protocol': '9',  # LiveKit protocol version
        'sdk': 'python',
        'version': '0.8.0'
    }

    url = f"{base_url}?{urlencode(params)}"

    print(f"Testing connection to: {base_url}")
    print(f"Token: {token[:50]}...")
    print("=" * 60)

    try:
        print("Attempting WebSocket connection...")

        # Try to connect with timeout
        async with websockets.connect(
            url,
            timeout=10,
            extra_headers={
                'User-Agent': 'PumpRoulette-Test/1.0'
            }
        ) as websocket:
            print("✅ WebSocket connection successful!")

            # Wait for initial messages
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5)
                print(f"📨 Received message: {message}")

                # Try to parse as JSON
                try:
                    data = json.loads(message)
                    print(f"📊 Parsed data: {json.dumps(data, indent=2)}")
                except:
                    print(f"📄 Raw message: {message}")

            except asyncio.TimeoutError:
                print("⏰ No initial message received (timeout)")

            print("🔌 Connection established successfully")

    except websockets.exceptions.ConnectionClosedError as e:
        print(f"❌ Connection closed: {e}")
        print(f"   Code: {e.code}")
        print(f"   Reason: {e.reason}")

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Invalid status code: {e}")
        print(f"   Status: {e.status_code}")

    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")

    except Exception as e:
        print(f"❌ General error: {e}")
        print(f"   Type: {type(e).__name__}")

if __name__ == "__main__":
    print("Testing LiveKit WebSocket Connection")
    print("=" * 60)
    asyncio.run(test_livekit_connection())