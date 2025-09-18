#!/usr/bin/env python3

import requests
import asyncio
from services.audio_room_service import AudioRoomService

async def test_api_endpoint():
    """Test the full API endpoint flow"""

    # Create audio room service
    audio_service = AudioRoomService()

    # Create a test room first
    print("1. Creating test audio room...")
    room_data = await audio_service.create_audio_room(
        pair_id="api_test_room_001",
        streamer_a_id="streamer_a_wallet",
        streamer_b_id="streamer_b_wallet",
        summoner_id="test_summoner"
    )

    print(f"✅ Created room: {room_data['pair_id']}")

    # Mark a streamer as joined to make room available
    print("2. Simulating streamer join...")
    success, is_first = await audio_service.mark_streamer_joined_by_role("api_test_room_001", "streamer_a")
    print(f"✅ Streamer joined: success={success}, is_first={is_first}")

    # Now test the API endpoint
    print("3. Testing API endpoint...")
    api_url = f"http://localhost:8000/api/v1/audio/stream/api_test_room_001"

    try:
        response = requests.get(api_url, timeout=10)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("✅ API Response:")
            print(f"  - success: {data.get('success')}")
            print(f"  - stream_id: {data.get('stream_id')}")
            print(f"  - viewer_token: {'Present' if data.get('viewer_token') else 'Missing'}")
            print(f"  - viewer_token length: {len(data.get('viewer_token', ''))}")
            print(f"  - participants: {len(data.get('participants', []))}")
            print(f"  - listener_count: {data.get('listener_count')}")

            # Test token
            if data.get('viewer_token'):
                print("\n4. Testing token validity...")
                import jwt
                try:
                    # Decode without verification to see content
                    token_payload = jwt.decode(data['viewer_token'], options={"verify_signature": False})
                    print("✅ Token decoded successfully:")
                    print(f"  - sub: {token_payload.get('sub')}")
                    print(f"  - name: {token_payload.get('name')}")
                    print(f"  - room: {token_payload.get('video', {}).get('room')}")
                    print(f"  - canPublish: {token_payload.get('video', {}).get('canPublish')}")
                    print(f"  - canSubscribe: {token_payload.get('video', {}).get('canSubscribe')}")
                    print(f"  - canPublishData: {token_payload.get('video', {}).get('canPublishData')}")
                except Exception as e:
                    print(f"❌ Token decode error: {e}")

        elif response.status_code == 425:
            print("❌ HTTP 425: Streamers not ready")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api_endpoint())