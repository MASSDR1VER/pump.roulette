#!/usr/bin/env python3

import asyncio
from services.audio_room_service import AudioRoomService

async def create_test_room_for_frontend():
    """Create a test room and generate a viewer token for frontend testing"""

    # Create audio room service
    audio_service = AudioRoomService()

    # Create a test room
    print("1. Creating test audio room for frontend...")
    room_data = await audio_service.create_audio_room(
        pair_id="frontend_test_001",
        streamer_a_id="test_streamer_a",
        streamer_b_id="test_streamer_b",
        summoner_id="test_viewer"
    )

    print(f"✅ Room created: {room_data['pair_id']}")

    # Mark a streamer as joined to enable viewer tokens
    print("2. Marking streamer as joined...")
    success, is_first = await audio_service.mark_streamer_joined_by_role("frontend_test_001", "streamer_a")
    print(f"✅ Streamer marked: success={success}, is_first={is_first}")

    # Generate viewer token
    print("3. Generating viewer token...")
    viewer_token = audio_service.generate_viewer_token(
        pair_id="frontend_test_001",
        viewer_id="frontend_viewer_test"
    )

    print("=" * 80)
    print("🎧 FRONTEND TEST DATA:")
    print(f"Room ID: frontend_test_001")
    print(f"LiveKit URL: {audio_service.livekit_url}")
    print(f"Viewer Token: {viewer_token}")
    print("=" * 80)
    print()
    print("Test this in frontend by calling API:")
    print("curl http://localhost:8000/api/v1/audio/stream/frontend_test_001")
    print()

    return viewer_token

if __name__ == "__main__":
    asyncio.run(create_test_room_for_frontend())