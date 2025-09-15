"""
Stream Scraper Service

Scrapes actual stream URLs from Pump.fun pages.
Since Pump.fun doesn't provide direct stream URLs, we need to extract them.
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import json
import re
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class StreamScraper:
    """
    Scrapes stream information from Pump.fun coin pages.

    Pump.fun uses various methods for streaming:
    - HLS streams (.m3u8)
    - WebRTC
    - YouTube/Twitch embeds
    """

    def __init__(self):
        """Initialize the stream scraper."""
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            follow_redirects=True,
            timeout=30.0
        )

    async def get_stream_data(self, mint: str) -> Optional[Dict[str, Any]]:
        """
        Scrape stream data from a Pump.fun coin page.

        Args:
            mint (str): Token mint address

        Returns:
            Optional[Dict[str, Any]]: Stream data including video URLs if found
        """
        try:
            url = f"https://pump.fun/coin/{mint}"
            logger.info(f"Scraping stream data from: {url}")

            response = await self.client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Look for video elements
            video_data = {}

            # Check for HLS stream URLs (.m3u8)
            m3u8_pattern = re.compile(r'https?://[^\s"]+\.m3u8')
            m3u8_matches = m3u8_pattern.findall(response.text)
            if m3u8_matches:
                video_data['hls_url'] = m3u8_matches[0]
                logger.info(f"Found HLS stream: {m3u8_matches[0]}")

            # Check for video/iframe elements
            video_elements = soup.find_all('video')
            if video_elements:
                for video in video_elements:
                    if video.get('src'):
                        video_data['video_url'] = video['src']
                        break

            # Check for YouTube/Twitch embeds
            iframes = soup.find_all('iframe')
            for iframe in iframes:
                src = iframe.get('src', '')
                if 'youtube.com' in src or 'twitch.tv' in src:
                    video_data['embed_url'] = src
                    video_data['embed_type'] = 'youtube' if 'youtube.com' in src else 'twitch'
                    logger.info(f"Found embed: {src}")

            # Look for JSON-LD data that might contain stream info
            scripts = soup.find_all('script', type='application/json')
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    # Check if this contains stream data
                    if 'stream' in str(data).lower() or 'video' in str(data).lower():
                        video_data['json_data'] = data
                except:
                    pass

            # Extract token metadata from the page
            token_data = {
                'mint': mint,
                'has_stream': bool(video_data),
                'stream_data': video_data
            }

            # Try to find the actual streaming component
            # Pump.fun might use React/Next.js, so check for __NEXT_DATA__
            next_data_script = soup.find('script', id='__NEXT_DATA__')
            if next_data_script:
                try:
                    next_data = json.loads(next_data_script.string)
                    # Extract relevant data from Next.js props
                    props = next_data.get('props', {}).get('pageProps', {})

                    # Look for stream-related data
                    if 'stream' in props or 'video' in props:
                        token_data['next_data'] = props
                        logger.info("Found Next.js stream data")
                except:
                    pass

            return token_data

        except Exception as e:
            logger.error(f"Error scraping stream for {mint}: {e}")
            return None

    async def find_live_streams(self) -> list:
        """
        Find tokens that actually have live streams.

        Returns:
            list: List of tokens with active streams
        """
        # This would need to check multiple tokens to find which ones have streams
        # For now, return empty as this is just a helper
        return []

    async def cleanup(self):
        """Close the HTTP client."""
        await self.client.aclose()


async def test_scraper():
    """Test the stream scraper with a known token."""
    scraper = StreamScraper()

    # Test with an active live stream token
    test_mint = "BmBXXWMGCRgoCQ6KdnFL2Fkmb2oBJWhgpNM5cdYnpump"

    data = await scraper.get_stream_data(test_mint)
    print(json.dumps(data, indent=2))

    await scraper.cleanup()


if __name__ == "__main__":
    asyncio.run(test_scraper())