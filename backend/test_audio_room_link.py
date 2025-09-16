#!/usr/bin/env python3
"""
Test script to create an audio room and display the test link
"""

import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from services.audio_room_service import AudioRoomService

async def main():
    print("\n" + "="*80)
    print("🎤 AUDIO ROOM TEST LINK GENERATOR")
    print("="*80)

    # Initialize service
    audio_service = AudioRoomService()

    # Create test room
    test_pair_id = f"test-pair-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    streamer_a_id = "alice-wallet-address"
    streamer_b_id = "bob-wallet-address"

    print(f"\nCreating audio room for pair: {test_pair_id}")
    print(f"Streamer A: {streamer_a_id}")
    print(f"Streamer B: {streamer_b_id}")

    # Create the room
    room_data = await audio_service.create_audio_room(
        pair_id=test_pair_id,
        streamer_a_id=streamer_a_id,
        streamer_b_id=streamer_b_id
    )

    print("\n" + "="*80)
    print("✅ AUDIO ROOM CREATED SUCCESSFULLY!")
    print("="*80)

    print(f"\n📍 Room Name: {room_data['room_name']}")
    print(f"⏰ Expires At: {room_data['expires_at']}")

    print("\n" + "="*80)
    print("🌐 TEST LINKS:")
    print("="*80)

    # Display test links
    base_url = "http://localhost:3001"

    print("\n1️⃣ STREAMER A TEST LINK (Main App):")
    print(f"   {base_url}/?room={test_pair_id}&token={room_data['streamer_a']['token']}")

    print("\n2️⃣ STREAMER B TEST LINK (Main App):")
    print(f"   {base_url}/?room={test_pair_id}&token={room_data['streamer_b']['token']}")

    print("\n3️⃣ AUDIO TEST APP (Recommended for testing):")
    print(f"   Streamer A: {base_url}/audio-test-app.html?room={test_pair_id}&token={room_data['streamer_a']['token']}")
    print(f"   Streamer B: {base_url}/audio-test-app.html?room={test_pair_id}&token={room_data['streamer_b']['token']}")

    # Generate viewer tokens
    viewer_token_1 = audio_service.generate_viewer_token(test_pair_id, "viewer-1")
    viewer_token_2 = audio_service.generate_viewer_token(test_pair_id, "viewer-2")

    print("\n4️⃣ VIEWER TEST LINKS (Listen Only):")
    print(f"   Viewer 1: {base_url}/audio-test-app.html?room={test_pair_id}&token={viewer_token_1}")
    print(f"   Viewer 2: {base_url}/audio-test-app.html?room={test_pair_id}&token={viewer_token_2}")

    print("\n5️⃣ HTML TEST PAGE:")
    print(f"   Open test-livekit.html and use these tokens:")
    print(f"   - Streamer A Token: {room_data['streamer_a']['token']}")
    print(f"   - Streamer B Token: {room_data['streamer_b']['token']}")

    print("\n" + "="*80)
    print("📝 INSTRUCTIONS:")
    print("="*80)
    print("1. Open the first link in one browser tab to join as Streamer A")
    print("2. Open the second link in another tab to join as Streamer B")
    print("3. Both streamers should be able to talk to each other")
    print("4. The room will expire in 2 hours")

    print("\n" + "="*80)
    print("🔧 DEBUGGING INFO:")
    print("="*80)
    print(f"LiveKit URL: {audio_service.livekit_url}")
    print(f"API Key: {audio_service.api_key[:10]}..." if audio_service.api_key else "API Key: Not configured")
    print("\n")

if __name__ == "__main__":
    asyncio.run(main())