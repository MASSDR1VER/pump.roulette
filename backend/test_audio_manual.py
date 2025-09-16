"""
Manual Audio Room Testing Script

This script creates test audio rooms and generates tokens for manual testing
with LiveKit. You can use the generated URLs to test audio connections.
"""

import asyncio
import jwt
import json
from datetime import datetime
from services.audio_room_service import AudioRoomService
from colorama import init, Fore, Style

# Initialize colorama for colored output
init(autoreset=True)


def decode_token(token: str) -> dict:
    """Decode JWT token without verification to inspect contents."""
    try:
        # Decode without verification to see the contents
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded
    except Exception as e:
        return {"error": str(e)}


def print_token_info(label: str, token: str):
    """Print formatted token information."""
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}{label}")
    print(f"{Fore.CYAN}{'='*60}")

    # Print token (truncated for display)
    print(f"{Fore.GREEN}Token (first 50 chars):{Style.RESET_ALL} {token[:50]}...")

    # Decode and print token contents
    decoded = decode_token(token)
    print(f"\n{Fore.GREEN}Decoded Token Contents:{Style.RESET_ALL}")
    print(json.dumps(decoded, indent=2, default=str))


async def test_audio_room():
    """Test audio room creation and token generation."""

    print(f"{Fore.MAGENTA}╔{'═'*58}╗")
    print(f"{Fore.MAGENTA}║{' '*20}AUDIO ROOM TEST{' '*23}║")
    print(f"{Fore.MAGENTA}╚{'═'*58}╝\n")

    # Initialize the audio room service
    audio_service = AudioRoomService()

    # Print LiveKit configuration
    print(f"{Fore.CYAN}LiveKit Configuration:")
    print(f"  URL: {Fore.WHITE}{audio_service.livekit_url}")
    print(f"  API Key: {Fore.WHITE}{audio_service.api_key[:10]}...")
    print(f"  Has Secret: {Fore.WHITE}{'Yes' if audio_service.api_secret else 'No'}\n")

    # Test parameters
    test_pair_id = f"test-pair-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    streamer_a_id = "alice-wallet-address"
    streamer_b_id = "bob-wallet-address"

    print(f"{Fore.YELLOW}Creating test audio room...")
    print(f"  Pair ID: {Fore.WHITE}{test_pair_id}")
    print(f"  Streamer A: {Fore.WHITE}{streamer_a_id}")
    print(f"  Streamer B: {Fore.WHITE}{streamer_b_id}\n")

    # Create audio room
    try:
        room_data = await audio_service.create_audio_room(
            pair_id=test_pair_id,
            streamer_a_id=streamer_a_id,
            streamer_b_id=streamer_b_id
        )

        print(f"{Fore.GREEN}✓ Audio room created successfully!")
        print(f"  Room Name: {Fore.WHITE}{room_data['room_name']}")
        print(f"  Expires At: {Fore.WHITE}{room_data['expires_at']}\n")

    except Exception as e:
        print(f"{Fore.RED}✗ Failed to create audio room: {e}")
        return

    # Generate tokens
    print(f"{Fore.YELLOW}Generating access tokens...\n")

    # Streamer A token
    streamer_a_token = audio_service._generate_streamer_token(
        room_data["room_name"],
        streamer_a_id,
        "Alice"
    )
    print_token_info("STREAMER A TOKEN", streamer_a_token)

    # Streamer B token
    streamer_b_token = audio_service._generate_streamer_token(
        room_data["room_name"],
        streamer_b_id,
        "Bob"
    )
    print_token_info("STREAMER B TOKEN", streamer_b_token)

    # Viewer token
    viewer_token = audio_service.generate_viewer_token(
        pair_id=test_pair_id,
        viewer_id="test-viewer-123"
    )
    if viewer_token:
        print_token_info("VIEWER TOKEN", viewer_token)

    # Generate test URLs
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}TEST URLS FOR LIVEKIT CONNECTION")
    print(f"{Fore.CYAN}{'='*60}\n")

    base_url = audio_service.livekit_url.replace("wss://", "https://")

    print(f"{Fore.GREEN}1. Streamer A URL:")
    print(f"{Fore.WHITE}   {audio_service.livekit_url}?token={streamer_a_token[:30]}...\n")

    print(f"{Fore.GREEN}2. Streamer B URL:")
    print(f"{Fore.WHITE}   {audio_service.livekit_url}?token={streamer_b_token[:30]}...\n")

    print(f"{Fore.GREEN}3. Viewer URL:")
    print(f"{Fore.WHITE}   {audio_service.livekit_url}?token={viewer_token[:30] if viewer_token else 'N/A'}...\n")

    # LiveKit Playground URL
    print(f"{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}LIVEKIT PLAYGROUND TEST")
    print(f"{Fore.CYAN}{'='*60}\n")

    playground_url = "https://livekit.io/playground"
    print(f"{Fore.GREEN}To test with LiveKit Playground:")
    print(f"1. Go to: {Fore.WHITE}{playground_url}")
    print(f"2. Click 'Custom' tab")
    print(f"3. Enter LiveKit URL: {Fore.WHITE}{audio_service.livekit_url}")
    print(f"4. Enter Token: {Fore.WHITE}[Copy one of the tokens above]")
    print(f"5. Click 'Connect'\n")

    # Test with curl
    print(f"{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}CURL TEST COMMANDS")
    print(f"{Fore.CYAN}{'='*60}\n")

    print(f"{Fore.GREEN}Test WebSocket connection with curl:")
    print(f"{Fore.WHITE}curl -i -N -H \"Connection: Upgrade\" -H \"Upgrade: websocket\" \\")
    print(f"  -H \"Sec-WebSocket-Version: 13\" \\")
    print(f"  -H \"Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==\" \\")
    print(f"  \"{audio_service.livekit_url}?token={streamer_a_token[:30]}...\"\n")

    # Room statistics
    print(f"{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}ROOM STATISTICS")
    print(f"{Fore.CYAN}{'='*60}\n")

    stats = audio_service.get_active_rooms_stats()
    print(f"{Fore.GREEN}Active Rooms Statistics:")
    print(json.dumps(stats, indent=2, default=str))

    print(f"\n{Fore.MAGENTA}{'='*60}")
    print(f"{Fore.MAGENTA}Test completed! Use the URLs above to connect to LiveKit.")
    print(f"{Fore.MAGENTA}{'='*60}\n")


async def cleanup_test_rooms():
    """Clean up any expired test rooms."""
    audio_service = AudioRoomService()
    cleaned = await audio_service.cleanup_expired_rooms()
    print(f"{Fore.YELLOW}Cleaned up {cleaned} expired rooms.\n")


async def main():
    """Main test function."""
    # Run the test
    await test_audio_room()

    # Optional: Clean up expired rooms
    # await cleanup_test_rooms()


if __name__ == "__main__":
    asyncio.run(main())