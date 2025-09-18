#!/usr/bin/env python3
"""
Test script for Pump.fun chat integration.

Usage:
    python test_pump_chat.py
"""

import sys
import time
import logging
from services.pumpfun_chat_client import PumpFunChatClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_chat_connection():
    """Test connecting and sending a message to pump.fun chat."""

    # Test token - replace with your token
    TEST_TOKEN = "3arUrpH3nzaRJbbpVgY42dcqSq9A5BFgUxKozZ4npump"

    print("=" * 60)
    print("Pump.fun Chat Test")
    print("=" * 60)
    print(f"Token: {TEST_TOKEN}")
    print()

    # Create chat client
    client = PumpFunChatClient(
        token_address=TEST_TOKEN,
        username="PumpRoulette_Test"
    )

    try:
        # Connect to chat
        print("🔌 Connecting to pump.fun chat...")
        if client.connect():
            print("✅ Connected successfully!")
            print()

            # Wait for room join
            print("⏳ Waiting for room join confirmation...")
            time.sleep(3)

            # Send test messages
            messages = [
                "🎤 PumpRoulette Audio Test",
                "Join the conversation: https://pump-roulette.com",
                "Testing chat integration... 🚀"
            ]

            for i, msg in enumerate(messages, 1):
                print(f"📤 Sending message {i}/{len(messages)}: {msg}")
                success = client.send_message(msg)

                if success:
                    print(f"✅ Message {i} sent successfully")
                else:
                    print(f"❌ Failed to send message {i}")

                # Wait between messages
                time.sleep(2)

            print()
            print("📊 Test Summary:")
            print("- Connection: Success")
            print("- Messages sent: 3")

            # Keep connection alive for a bit to see responses
            print()
            print("⏳ Keeping connection alive for 10 seconds...")
            time.sleep(10)

        else:
            print("❌ Failed to connect to chat")
            return False

    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        logger.exception("Test error")
        return False

    finally:
        # Disconnect
        print()
        print("🔌 Disconnecting...")
        client.disconnect()
        print("✅ Disconnected")

    print()
    print("=" * 60)
    print("Test completed successfully!")
    print("=" * 60)

    return True


def test_invite_link_format():
    """Test creating invite links for streamers."""

    print("\n" + "=" * 60)
    print("Testing Invite Link Format")
    print("=" * 60)

    # Example data
    room_id = "test_room_123"
    base_url = "https://pump-roulette.com"

    # Create invite links for streamers
    streamer_a_link = f"{base_url}/?room={room_id}&role=streamer_a"
    streamer_b_link = f"{base_url}/?room={room_id}&role=streamer_b"

    print(f"Room ID: {room_id}")
    print()
    print("Streamer A invite link:")
    print(f"  {streamer_a_link}")
    print()
    print("Streamer B invite link:")
    print(f"  {streamer_b_link}")
    print()

    # Format messages
    invite_message_a = f"🎤 You've been invited to PumpRoulette Audio!\n\nJoin as Streamer A:\n{streamer_a_link}\n\n🔊 Live voice chat for your token!"
    invite_message_b = f"🎤 You've been invited to PumpRoulette Audio!\n\nJoin as Streamer B:\n{streamer_b_link}\n\n🔊 Live voice chat for your token!"

    print("Formatted invite message for Streamer A:")
    print("-" * 40)
    print(invite_message_a)
    print("-" * 40)
    print()
    print("Formatted invite message for Streamer B:")
    print("-" * 40)
    print(invite_message_b)
    print("-" * 40)

    return True


if __name__ == "__main__":
    print("\n🚀 Starting Pump.fun Chat Tests\n")

    # Test 1: Chat connection and messaging
    print("Test 1: Chat Connection and Messaging")
    test_success = test_chat_connection()

    # Test 2: Invite link format
    print("\nTest 2: Invite Link Format")
    test_invite_link_format()

    # Exit with appropriate code
    sys.exit(0 if test_success else 1)