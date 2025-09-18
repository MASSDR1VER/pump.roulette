"""
PumpFun WebSocket Chat Service

Sends messages to pump.fun chat rooms via WebSocket using Node.js bridge.
"""

import asyncio
import json
import logging
import subprocess
import os
import aiohttp
from typing import Dict
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class PumpFunWebSocketService:
    """
    Service for sending messages to pump.fun chat via WebSocket.
    Uses Node.js pump-chat-client as it can bypass Cloudflare.
    """

    def __init__(self):
        """Initialize the WebSocket service."""
        # Dynamically resolve path to Node.js script
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.node_script_path = os.path.join(current_dir, '..', '..', 'pump-fun-chat-mcp', 'send_pump_message.js')
        self.auth_token = os.getenv('PUMPFUN_AUTH_TOKEN')
        self.chat_message_template = os.getenv('PUMPFUN_CHAT_MESSAGE', '🎤 Voice battle invite! Check comments for link')
        self.comment_message_template = os.getenv('PUMPFUN_COMMENT_MESSAGE', '🎤 Join voice battle: {link}')

    async def send_chat_message(
        self,
        token_address: str,
        message: str
    ) -> bool:
        """
        Send a message to pump.fun chat room.

        Args:
            token_address: The token's mint address (chat room ID)
            message: The message to send

        Returns:
            True if message sent successfully
        """
        try:
            # Run Node.js script to send message with auth token
            result = await asyncio.create_subprocess_exec(
                'node',
                self.node_script_path,
                token_address,
                message,
                self.auth_token,  # Pass auth token as third argument
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            stdout, stderr = await result.communicate()

            # Check stdout and stderr separately
            stdout_text = stdout.decode()
            stderr_text = stderr.decode()

            # ALWAYS log the output to see what's happening
            logger.info(f"Node.js stdout: {stdout_text}")
            if stderr_text:
                logger.info(f"Node.js stderr: {stderr_text}")

            # Check success in stdout
            if "Message sent, disconnected" in stdout_text:
                logger.info(f"Successfully sent message to {token_address[:8]}...")
                return True

            # Check for errors in both stdout and stderr
            combined_output = stdout_text + stderr_text

            if "Authentication required" in combined_output:
                logger.error("Authentication required - need valid auth token")
                return False
            elif "EXTERNAL_URL" in combined_output:
                logger.warning("Message rejected due to external URL")
                return False
            elif "content moderation" in combined_output:
                logger.warning("Message rejected by moderation system")
                return False
            elif "PERSONAL_INFO" in combined_output:
                logger.warning("Message rejected - contains personal info")
                return False
            else:
                logger.error(f"Failed to send message. stdout: {stdout_text}, stderr: {stderr_text}")
                return False

        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            return False

    async def post_comment(self, token_address: str, comment_text: str) -> bool:
        """
        Post a comment to a token's page.

        Args:
            token_address: The token's mint address
            comment_text: The comment text to post

        Returns:
            True if comment posted successfully
        """
        try:
            headers = {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://pump.fun',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Cookie': f'auth_token={self.auth_token}'
            }

            data = {
                "text": comment_text,
                "mint": token_address
            }

            connector = aiohttp.TCPConnector(ssl=False)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.post(
                    'https://frontend-api-v3.pump.fun/replies',
                    headers=headers,
                    json=data
                ) as response:
                    response_text = await response.text()
                    if response.status == 201:
                        logger.info(f"Successfully posted comment to {token_address[:8]}...")
                        return True
                    else:
                        logger.error(f"Failed to post comment. Status: {response.status}, Response: {response_text[:500]}")
                        return False

        except Exception as e:
            logger.error(f"Error posting comment: {e}")
            return False

    async def send_invite_to_streamer(
        self,
        token_address: str,
        room_id: str,
        role: str,
        paired_token: str
    ) -> Dict[str, bool]:
        """
        Send an invite message to a streamer's chat and post comment with link.

        Args:
            token_address: The streamer's token address
            room_id: The audio room ID
            role: Either "streamer_a" or "streamer_b"
            paired_token: The other streamer's token address

        Returns:
            Dict with success status for chat and comment
        """
        results = {}

        # Post comment first (with link)
        base_url = "https://app.pump-roulette.com"
        invite_link = f"{base_url}/?room={room_id}&role={role}"

        comment_text = self.comment_message_template.replace('{link}', invite_link)

        results['comment'] = await self.post_comment(token_address, comment_text)

        # Wait a bit between comment and chat
        await asyncio.sleep(2)

        # Then send chat message
        message = self.chat_message_template
        results['chat'] = await self.send_chat_message(token_address, message)

        return results

    async def notify_both_streamers(
        self,
        stream_1_mint: str,
        stream_2_mint: str,
        room_id: str
    ) -> Dict[str, Dict[str, bool]]:
        """
        Notify both streamers about the audio room via WebSocket and comments.

        Args:
            stream_1_mint: First stream's token mint address
            stream_2_mint: Second stream's token mint address
            room_id: The audio room ID

        Returns:
            Dictionary with success status for each stream (chat and comment)
        """
        results = {}

        # Notify first streamer (chat + comment)
        results['stream_1'] = await self.send_invite_to_streamer(
            stream_1_mint,
            room_id,
            "streamer_a",
            stream_2_mint
        )

        # Wait longer to avoid spam detection
        await asyncio.sleep(5)

        # Notify second streamer (chat + comment)
        results['stream_2'] = await self.send_invite_to_streamer(
            stream_2_mint,
            room_id,
            "streamer_b",
            stream_1_mint
        )

        logger.info(f"Notification results: {results}")
        return results


# Example usage
if __name__ == "__main__":
    async def test():
        service = PumpFunWebSocketService()

        # Test sending a message
        success = await service.send_chat_message(
            "3arUrpH3nzaRJbbpVgY42dcqSq9A5BFgUxKozZ4npump",
            "🎤 Testing PumpRoulette WebSocket integration!"
        )

        print(f"Message sent: {success}")

    asyncio.run(test())