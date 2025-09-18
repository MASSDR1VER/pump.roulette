#!/usr/bin/env python3

from livekit import api
import base64
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# LiveKit credentials from environment variables
api_key = os.getenv("LIVEKIT_API_KEY", "")
api_secret = os.getenv("LIVEKIT_API_SECRET", "")

def test_viewer_token():
    """Test viewer token generation and LiveKit connection"""
    room_name = f"test_room_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    viewer_id = "test_viewer_123"
    display_name = "Test Viewer"

    print(f"Creating viewer token for room: {room_name}")
    print(f"Viewer ID: {viewer_id}")
    print(f"Display Name: {display_name}")
    print("=" * 60)

    # Create viewer token with canPublishData: true
    token = api.AccessToken(api_key, api_secret)
    token = token.with_identity(viewer_id)
    token = token.with_name(display_name)
    token = token.with_metadata(f'{{"role":"viewer","display_name":"{display_name}"}}')
    token = token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=False,      # Cannot publish audio/video
        can_subscribe=True,     # Can listen to audio
        can_publish_data=True   # Can publish data (allows room creation)
    ))

    jwt_token = token.to_jwt()

    print("VIEWER TOKEN:")
    print(jwt_token)
    print()

    # Decode token to verify content
    try:
        # Split JWT and decode payload
        header, payload, signature = jwt_token.split('.')
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        decoded_payload = json.loads(base64.b64decode(payload))

        print("DECODED TOKEN PAYLOAD:")
        print(json.dumps(decoded_payload, indent=2))
        print()

        print("VIDEO GRANTS:")
        video_grants = decoded_payload.get('video', {})
        print(f"  room: {video_grants.get('room')}")
        print(f"  roomJoin: {video_grants.get('roomJoin')}")
        print(f"  canPublish: {video_grants.get('canPublish')}")
        print(f"  canSubscribe: {video_grants.get('canSubscribe')}")
        print(f"  canPublishData: {video_grants.get('canPublishData')}")
        print()

    except Exception as e:
        print(f"Error decoding token: {e}")

    # Generate test URLs
    livekit_url = "wss://pump-udxzob1q.livekit.cloud"
    test_url = f"{livekit_url}?token={jwt_token}"

    print("TEST URLS:")
    print(f"LiveKit Playground: https://livekit.io/playground")
    print(f"Select 'Custom' tab and use this URL:")
    print(test_url)
    print()

    print("EXPECTED BEHAVIOR:")
    print("✓ Token should be valid")
    print("✓ Should be able to join room (even if empty)")
    print("✓ Should NOT be able to publish audio/video")
    print("✓ Should be able to receive audio from publishers")
    print("✓ Should be able to send data messages")

    return jwt_token, test_url

if __name__ == "__main__":
    test_viewer_token()