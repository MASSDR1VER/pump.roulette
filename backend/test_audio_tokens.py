"""
Generate Full Audio Room Tokens for Testing

This script generates complete tokens that can be directly used for testing.
"""

import asyncio
from datetime import datetime
from services.audio_room_service import AudioRoomService


async def generate_test_tokens():
    """Generate and display full tokens for testing."""

    # Initialize the audio room service
    audio_service = AudioRoomService()

    # Test parameters
    test_pair_id = f"test-pair-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    streamer_a_id = "alice-wallet-address"
    streamer_b_id = "bob-wallet-address"

    print("Creating test audio room...")
    print(f"Pair ID: {test_pair_id}")
    print("=" * 80)

    # Create audio room
    room_data = await audio_service.create_audio_room(
        pair_id=test_pair_id,
        streamer_a_id=streamer_a_id,
        streamer_b_id=streamer_b_id
    )

    print(f"\nRoom Name: {room_data['room_name']}")
    print(f"LiveKit URL: {audio_service.livekit_url}")
    print("\n" + "=" * 80)

    # Generate tokens
    streamer_a_token = audio_service._generate_streamer_token(
        room_data["room_name"],
        streamer_a_id,
        "Alice"
    )

    streamer_b_token = audio_service._generate_streamer_token(
        room_data["room_name"],
        streamer_b_id,
        "Bob"
    )

    viewer_token = audio_service.generate_viewer_token(
        pair_id=test_pair_id,
        viewer_id="test-viewer-123"
    )

    # Print full tokens
    print("\nSTREAMER A (Alice) - Full Token:")
    print("-" * 80)
    print(streamer_a_token)
    print("\nSTREAMER A - Test URL:")
    print(f"{audio_service.livekit_url}?token={streamer_a_token}")

    print("\n" + "=" * 80)
    print("\nSTREAMER B (Bob) - Full Token:")
    print("-" * 80)
    print(streamer_b_token)
    print("\nSTREAMER B - Test URL:")
    print(f"{audio_service.livekit_url}?token={streamer_b_token}")

    print("\n" + "=" * 80)
    print("\nVIEWER - Full Token:")
    print("-" * 80)
    print(viewer_token)
    print("\nVIEWER - Test URL:")
    print(f"{audio_service.livekit_url}?token={viewer_token}")

    print("\n" + "=" * 80)
    print("\nHOW TO TEST:")
    print("1. Copy one of the test URLs above")
    print("2. Go to: https://livekit.io/playground")
    print("3. Click 'Custom' tab")
    print("4. Paste the full URL (including token)")
    print("5. Click 'Connect'")
    print("\nOR use the token directly in your application")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(generate_test_tokens())