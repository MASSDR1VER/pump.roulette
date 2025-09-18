#!/usr/bin/env python3
"""
Test script for Pump.fun notification service with invite links.

Usage:
    python test_notification_service.py
"""

import asyncio
import sys
import logging
from services.pumpfun_notification_service import PumpFunNotificationService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def test_notification_service():
    """Test sending notifications with invite links to pump.fun chat."""

    # Test token - replace with your token
    TEST_TOKEN = "3arUrpH3nzaRJbbpVgY42dcqSq9A5BFgUxKozZ4npump"
    # Second test token for pairing
    TEST_TOKEN_2 = "7wFTYNZPAK7WbzSR8EhfmosaDb7jTL7wDnWjGAXP68jN"

    # Test room ID
    TEST_ROOM_ID = "test_room_" + str(int(asyncio.get_event_loop().time()))

    print("=" * 60)
    print("Pump.fun Notification Service Test")
    print("=" * 60)
    print(f"Token 1: {TEST_TOKEN}")
    print(f"Token 2: {TEST_TOKEN_2}")
    print(f"Room ID: {TEST_ROOM_ID}")
    print()

    # Create notification service
    notification_service = PumpFunNotificationService()

    try:
        # Test 1: Send custom notification
        print("Test 1: Sending custom notification...")
        custom_message = "🎤 Testing PumpRoulette notification system!"
        result = await notification_service.send_custom_notification(
            TEST_TOKEN,
            custom_message
        )

        if result:
            print("✅ Custom notification sent successfully!")
        else:
            print("❌ Failed to send custom notification")

        print()

        # Wait a bit between messages
        await asyncio.sleep(2)

        # Test 2: Send streamer invitations with links
        print("Test 2: Sending streamer invitations...")
        results = await notification_service.notify_both_streamers(
            stream_1_mint=TEST_TOKEN,
            stream_2_mint=TEST_TOKEN_2,
            room_id=TEST_ROOM_ID
        )

        print(f"Stream 1 notification: {'✅ Success' if results.get('stream_1') else '❌ Failed'}")
        print(f"Stream 2 notification: {'✅ Success' if results.get('stream_2') else '❌ Failed'}")

        print()
        print("Expected messages sent to chats:")
        print("-" * 40)
        print(f"To {TEST_TOKEN[:8]}...:")
        print(f"  🎤 You've been invited to PumpRoulette Audio!")
        print(f"  Join as Streamer A:")
        print(f"  https://pump-roulette.com/?room={TEST_ROOM_ID}&role=streamer_a")
        print()
        print(f"To {TEST_TOKEN_2[:8]}...:")
        print(f"  🎤 You've been invited to PumpRoulette Audio!")
        print(f"  Join as Streamer B:")
        print(f"  https://pump-roulette.com/?room={TEST_ROOM_ID}&role=streamer_b")
        print("-" * 40)

        # Overall test result
        if results.get('stream_1') or results.get('stream_2'):
            print()
            print("✅ At least one notification was sent successfully!")
            return True
        else:
            print()
            print("❌ Both notifications failed")
            return False

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        logger.exception("Test error")
        return False

    finally:
        print()
        print("=" * 60)
        print("Test completed!")
        print("=" * 60)


if __name__ == "__main__":
    print("\n🚀 Starting Pump.fun Notification Service Test\n")

    # Run the test
    test_success = asyncio.run(test_notification_service())

    # Exit with appropriate code
    sys.exit(0 if test_success else 1)