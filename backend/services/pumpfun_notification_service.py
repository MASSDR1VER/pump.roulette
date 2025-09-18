"""
PumpFun Notification Service

Sends notifications to streamers via Pump.fun's reply API.
This allows us to notify token creators about audio room invitations.
"""

import aiohttp
import logging
from typing import Optional, Dict, Any
from config.settings import settings

logger = logging.getLogger(__name__)


class PumpFunNotificationService:
    """
    Service for sending notifications via Pump.fun's reply API.
    """

    def __init__(self):
        """Initialize the notification service."""
        self.api_url = "https://frontend-api-v3.pump.fun/replies"

        # Headers to mimic browser request
        self.headers = {
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
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
        }

        # Use all required cookies from settings
        self.cookies = {
            '_ga': 'GA1.1.855120383.1746559821',
            'intercom-id-w7scljv7': '07078697-03c9-481f-9bd1-3bdc287afc19',
            'intercom-device-id-w7scljv7': 'd832200a-67df-4e81-b0b6-d323724d9f8d',
            'auth_token': settings.PUMPFUN_AUTH_TOKEN if settings.PUMPFUN_AUTH_TOKEN else 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiN3dGVFlOWlBBSzdXYnpTUjhFaGZtb3NhRGI3alRMN3dEbldqR0FYUDY4ak4iLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTc1ODA1NzE4MiwiZXhwIjoxNzYwNjQ5MTgyfQ.uMKSXWOI_nMhDpWHv5YgAx27p3VMdLeI0T9xpxceUTg',
            '_cfuvid': 'tOsQ8SMv0fEPK89V5ZufnoNhaORldgi3CB_5EhXXxdQ-1757985153465-0.0.1.1-604800000',
            'cf_clearance': '9btlN7v20Uswj7llI6hjPOdT4ZpENn8omNbJsWzCFAg-1757985154-1.2.1.1-PQPOrHjSaW_RuSArIVrMecYT1SDAAe2Wju0vO4OH788_gKSErFPGBhq69_AGt6nQpvmBlsxZrXVrd7B8e4fhPilwN2S75JEjPgtn2TeGE_LgzGh5_YSYhuMaR.jAUjsS0UiVNYDkbc3Duna37jH5RxNgFb.wIslqOsOMsQgcPq7PZA2BqacaZraqDAMmSS2y8T0QlhTYGI5GcOAygRPkjW8KSQ.J.ZwCimRkW13m_KM',
            '__cf_bm': 'C.kHQVKKmaHzl1PD91AaBOhwSsA2DOVkmdDqrAmL.Gs-1757985377-1.0.1.1-j2xr0cK4VWXz59asYXHR0Mm__WyXy9EhEmilEkjg3kiF_szpYl5Ni2UEk4.78611KAVVkT07YQ_T9wNQGk5KPYVaWHNU9MhvBTzHRck._oA',
            'fs_lua': '1.1757985154312',
            'fs_uid': '#o-1YWTMD-na1#31f9af5b-75fa-43b4-a886-7bd230719a7c:d7f1bad3-3836-4e4e-813b-4c967d163772:1757985154312::1#29096196#/1789440018',
            'intercom-session-w7scljv7': 'ZEZQakw1em9FWXZaSTdBVnNOUzlBZzdaVnlRNFhoZWZHeHY0VFdtcFYxWEdSNjcwZTBqREErWWhUang3MVZqYjBkOWJsWmVLV2taK3lUUVYvZVBKQTBvRjNYTkJVU3VFdFhYR25nMXl0YVE9LS0wMFRteE5lU2duSFI1YXpmWmRZdmFRPT0=--6eb4a6d989b91feab7716827898ec143f20b3b95',
            '_ga_T65NVS2TQ6': 'GS2.1.s1757985154$o8$g1$t1757985207$j7$l0$h0'
        }

        if not settings.PUMPFUN_AUTH_TOKEN:
            logger.warning("PUMPFUN_AUTH_TOKEN not configured in settings. Using default auth token.")

    async def send_audio_room_invitation(
        self,
        mint_address: str,
        room_id: str,
        join_url: str
    ) -> bool:
        """
        Send an audio room invitation to a token creator.

        Args:
            mint_address: The token's mint address
            room_id: The audio room ID
            join_url: URL to join the audio room

        Returns:
            True if notification sent successfully
        """
        try:
            # Create notification message
            message = (
                f"🎙️ You've been invited to join an audio conversation on PumpRoulette! "
                f"Room ID: {room_id[:8]}... "
                f"Join now to talk with your community! "
                f"https://pumproulette.com/audio/{room_id}"
            )

            # Prepare request data
            data = {
                "text": message,
                "mint": mint_address
            }

            # Send the notification
            async with aiohttp.ClientSession(cookies=self.cookies) as session:
                async with session.post(
                    self.api_url,
                    headers=self.headers,
                    json=data
                ) as response:
                    # 200 OK or 201 Created are both success
                    if response.status in [200, 201]:
                        logger.info(f"Notification sent successfully to token {mint_address[:8]}...")
                        return True
                    else:
                        logger.error(f"Failed to send notification: {response.status}")
                        text = await response.text()
                        logger.error(f"Response: {text}")
                        return False

        except Exception as e:
            logger.error(f"Error sending pump.fun notification: {e}")
            return False

    async def send_custom_notification(
        self,
        mint_address: str,
        message: str
    ) -> bool:
        """
        Send a custom notification to a token.

        Args:
            mint_address: The token's mint address
            message: Custom message to send

        Returns:
            True if notification sent successfully
        """
        try:
            data = {
                "text": message,
                "mint": mint_address
            }

            async with aiohttp.ClientSession(cookies=self.cookies) as session:
                async with session.post(
                    self.api_url,
                    headers=self.headers,
                    json=data
                ) as response:
                    # 200 OK or 201 Created are both success
                    if response.status in [200, 201]:
                        logger.info(f"Custom notification sent to {mint_address[:8]}...")
                        return True
                    else:
                        logger.error(f"Failed to send custom notification: {response.status}")
                        text = await response.text()
                        logger.error(f"Response: {text}")
                        return False

        except Exception as e:
            logger.error(f"Error sending custom notification: {e}")
            return False

    async def notify_both_streamers(
        self,
        stream_1_mint: str,
        stream_2_mint: str,
        room_id: str
    ) -> Dict[str, bool]:
        """
        Notify both streamers about the audio room.

        Args:
            stream_1_mint: First stream's token mint address
            stream_2_mint: Second stream's token mint address
            room_id: The audio room ID

        Returns:
            Dictionary with success status for each stream
        """
        results = {}

        # Base URL for the application
        base_url = "https://pump-roulette.com"

        # Create specific invite links for each streamer role
        streamer_a_link = f"{base_url}/?room={room_id}&role=streamer_a"
        streamer_b_link = f"{base_url}/?room={room_id}&role=streamer_b"

        # Notify first streamer (Streamer A)
        message_1 = (
            f"🎤 You've been invited to PumpRoulette Audio!\n\n"
            f"You're paired with {stream_2_mint[:8]}...\n\n"
            f"Join as Streamer A:\n"
            f"{streamer_a_link}\n\n"
            f"🔊 Live voice chat for your token!"
        )
        results['stream_1'] = await self.send_custom_notification(stream_1_mint, message_1)

        # Notify second streamer (Streamer B)
        message_2 = (
            f"🎤 You've been invited to PumpRoulette Audio!\n\n"
            f"You're paired with {stream_1_mint[:8]}...\n\n"
            f"Join as Streamer B:\n"
            f"{streamer_b_link}\n\n"
            f"🔊 Live voice chat for your token!"
        )
        results['stream_2'] = await self.send_custom_notification(stream_2_mint, message_2)

        return results