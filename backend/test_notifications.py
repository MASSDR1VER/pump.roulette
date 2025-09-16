"""
Test script for Pump.fun notification system

Tests the notification service to ensure it properly sends notifications
to token creators when audio rooms are created.
"""

import asyncio
import logging
from services.pumpfun_notification_service import PumpFunNotificationService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_notification_service():
    """Test the notification service with sample data."""

    # Initialize the service
    service = PumpFunNotificationService()

    # Test mint addresses (replace with actual token mints if testing)
    test_mint_1 = "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs"  # Example mint
    test_mint_2 = "8FU95xFJhUUkyyCLU13HSzFzehEWfVcwruMRvMwawMhE"  # Example mint
    test_room_id = "test-room-12345"

    print("Testing Pump.fun notification service...")
    print(f"Mint 1: {test_mint_1}")
    print(f"Mint 2: {test_mint_2}")
    print(f"Room ID: {test_room_id}")

    # Test single notification
    print("\n1. Testing single notification...")
    result = await service.send_audio_room_invitation(
        mint_address=test_mint_1,
        room_id=test_room_id,
        join_url=f"https://pumproulette.com/talk/{test_room_id}"
    )
    print(f"   Single notification result: {'✅ Success' if result else '❌ Failed'}")

    # Test custom notification
    print("\n2. Testing custom notification...")
    result = await service.send_custom_notification(
        mint_address=test_mint_1,
        message="🎙️ Test notification from PumpRoulette audio system!"
    )
    print(f"   Custom notification result: {'✅ Success' if result else '❌ Failed'}")

    # Test notification to both streamers
    print("\n3. Testing notification to both streamers...")
    results = await service.notify_both_streamers(
        stream_1_mint=test_mint_1,
        stream_2_mint=test_mint_2,
        room_id=test_room_id
    )
    print(f"   Stream 1 notification: {'✅ Success' if results.get('stream_1') else '❌ Failed'}")
    print(f"   Stream 2 notification: {'✅ Success' if results.get('stream_2') else '❌ Failed'}")

    print("\n✅ Notification tests completed!")
    print("\nNote: Check the pump.fun token pages for these mints to see if notifications appear.")
    print("If notifications fail, ensure PUMPFUN_AUTH_TOKEN is valid in .env file.")


if __name__ == "__main__":
    asyncio.run(test_notification_service())