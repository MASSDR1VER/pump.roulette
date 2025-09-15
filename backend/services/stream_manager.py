"""
Stream Manager Service

Manages Pump.fun stream selection, pairing, and metadata retrieval.
This service integrates with PumpFunClient to get real-time token data.
"""

import asyncio
import random
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging

from config.settings import settings
from services.pumpfun_client import PumpFunClient
from models.token import Token

logger = logging.getLogger(__name__)


@dataclass
class StreamMetadata:
    """
    Data class representing metadata for a Pump.fun stream.

    Attributes:
        stream_id (str): Unique identifier for the stream
        stream_url (str): Direct URL to the stream
        token_name (str): Name of the token being promoted
        token_address (str): Contract address of the token
        streamer_name (str): Name of the streamer
        viewer_count (int): Current number of viewers
        thumbnail_url (str): URL to the stream thumbnail
        is_live (bool): Whether the stream is currently live
        started_at (datetime): When the stream started
    """
    stream_id: str
    stream_url: str
    token_name: str
    token_address: str
    streamer_name: str
    viewer_count: int
    thumbnail_url: str
    is_live: bool
    started_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the StreamMetadata to a dictionary for JSON serialization.

        Returns:
            Dict[str, Any]: Dictionary representation of the stream metadata
        """
        data = asdict(self)
        data['started_at'] = self.started_at.isoformat()
        return data


class StreamManager:
    """
    Manages Pump.fun stream selection and pairing.

    This class handles fetching live streams from Pump.fun, maintaining a cache
    of active streams, and providing random pairing functionality for the roulette feature.

    Attributes:
        streams (List[StreamMetadata]): List of currently active streams
        last_fetch (datetime): Timestamp of the last stream fetch
        fetch_lock (asyncio.Lock): Lock to prevent concurrent fetches
        background_task (Optional[asyncio.Task]): Background task for auto-refresh
    """

    def __init__(self):
        """Initialize the StreamManager with empty stream list and fetch lock."""
        self.streams: List[StreamMetadata] = []
        self.last_fetch: Optional[datetime] = None
        self.fetch_lock = asyncio.Lock()
        self.background_task: Optional[asyncio.Task] = None
        self.http_client: Optional[httpx.AsyncClient] = None

    async def initialize(self) -> None:
        """
        Initialize the stream manager and start background tasks.

        This method sets up the HTTP client and starts the background refresh task.
        """
        logger.info("Initializing StreamManager...")

        # Initialize HTTP client for Pump.fun API
        self.http_client = httpx.AsyncClient(
            base_url=settings.PUMP_FUN_API_URL,
            headers={
                "User-Agent": f"{settings.APP_NAME}/{settings.VERSION}",
                "Accept": "application/json"
            },
            timeout=30.0
        )

        # Add API key if configured
        if settings.PUMP_FUN_API_KEY:
            self.http_client.headers["X-API-Key"] = settings.PUMP_FUN_API_KEY

        # Fetch initial stream list
        await self.refresh_streams()

        # Start background refresh task
        self.background_task = asyncio.create_task(self._background_refresh())

        logger.info(f"StreamManager initialized with {len(self.streams)} active streams")

    async def cleanup(self) -> None:
        """
        Clean up resources and stop background tasks.

        This method should be called when shutting down the application.
        """
        logger.info("Cleaning up StreamManager...")

        # Cancel background task
        if self.background_task:
            self.background_task.cancel()
            try:
                await self.background_task
            except asyncio.CancelledError:
                pass

        # Close HTTP client
        if self.http_client:
            await self.http_client.aclose()

        logger.info("StreamManager cleanup complete")

    async def _background_refresh(self) -> None:
        """
        Background task that periodically refreshes the stream list.

        Runs continuously and fetches new stream data at intervals defined in settings.
        """
        while True:
            try:
                await asyncio.sleep(settings.PUMP_FUN_REFRESH_INTERVAL)
                await self.refresh_streams()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background refresh: {e}")
                await asyncio.sleep(5)  # Wait before retrying

    async def refresh_streams(self) -> None:
        """
        Fetch and update the list of active streams from Pump.fun API.

        This method fetches the latest stream data and updates the internal cache.
        Uses a lock to prevent concurrent fetches.
        """
        async with self.fetch_lock:
            try:
                logger.debug("Fetching live streams from Pump.fun API...")

                response = await self.http_client.get(settings.PUMP_FUN_STREAM_ENDPOINT)
                response.raise_for_status()

                data = response.json()
                self.streams = self._parse_stream_data(data)
                self.last_fetch = datetime.utcnow()

                logger.info(f"Successfully fetched {len(self.streams)} live streams")

            except httpx.HTTPError as e:
                logger.error(f"HTTP error fetching streams: {e}")
                # Keep existing streams if fetch fails
            except Exception as e:
                logger.error(f"Unexpected error fetching streams: {e}")

    def _parse_stream_data(self, data: Any) -> List[StreamMetadata]:
        """
        Parse raw stream data from API into StreamMetadata objects.

        Args:
            data (Any): Raw data from Pump.fun API

        Returns:
            List[StreamMetadata]: Parsed stream metadata objects
        """
        streams = []

        # Handle different possible API response formats
        stream_list = data if isinstance(data, list) else data.get('streams', [])

        for stream_data in stream_list:
            try:
                # Parse stream data with fallbacks for missing fields
                stream = StreamMetadata(
                    stream_id=stream_data.get('id', ''),
                    stream_url=stream_data.get('url', ''),
                    token_name=stream_data.get('token_name', 'Unknown Token'),
                    token_address=stream_data.get('contract_address', ''),
                    streamer_name=stream_data.get('streamer_name', 'Anonymous'),
                    viewer_count=stream_data.get('viewer_count', 0),
                    thumbnail_url=stream_data.get('thumbnail', settings.DEFAULT_STREAM_THUMBNAIL),
                    is_live=stream_data.get('is_live', True),
                    started_at=datetime.fromisoformat(
                        stream_data.get('started_at', datetime.utcnow().isoformat())
                    )
                )

                # Only add live streams
                if stream.is_live and stream.stream_url:
                    streams.append(stream)

            except Exception as e:
                logger.warning(f"Error parsing stream data: {e}")
                continue

        return streams

    def get_active_streams(self) -> List[StreamMetadata]:
        """
        Get the list of currently active streams.

        Returns:
            List[StreamMetadata]: List of active stream metadata
        """
        return [s for s in self.streams if s.is_live]

    def get_random_pair(self) -> Optional[Tuple[StreamMetadata, StreamMetadata]]:
        """
        Select two random streams from the active pool.

        Returns:
            Optional[Tuple[StreamMetadata, StreamMetadata]]: A pair of stream objects
                or None if insufficient streams available
        """
        active_streams = self.get_active_streams()

        if len(active_streams) < settings.MIN_ACTIVE_STREAMS:
            logger.warning(f"Insufficient active streams: {len(active_streams)}")
            return None

        # Use random.sample to get 2 unique streams
        pair = random.sample(active_streams, 2)
        return (pair[0], pair[1])

    def get_stream_by_id(self, stream_id: str) -> Optional[StreamMetadata]:
        """
        Get a specific stream by its ID.

        Args:
            stream_id (str): The unique identifier of the stream

        Returns:
            Optional[StreamMetadata]: The stream metadata if found, None otherwise
        """
        for stream in self.streams:
            if stream.stream_id == stream_id:
                return stream
        return None

    def get_streams_by_token(self, token_address: str) -> List[StreamMetadata]:
        """
        Get all streams promoting a specific token.

        Args:
            token_address (str): The contract address of the token

        Returns:
            List[StreamMetadata]: List of streams for the specified token
        """
        return [
            stream for stream in self.streams
            if stream.token_address.lower() == token_address.lower()
        ]

    @property
    def needs_refresh(self) -> bool:
        """
        Check if the stream list needs to be refreshed.

        Returns:
            bool: True if refresh is needed, False otherwise
        """
        if not self.last_fetch:
            return True

        time_since_fetch = datetime.utcnow() - self.last_fetch
        return time_since_fetch > timedelta(seconds=settings.PUMP_FUN_REFRESH_INTERVAL * 2)

    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current stream state.

        Returns:
            Dict[str, Any]: Statistics including stream counts and top tokens
        """
        active_streams = self.get_active_streams()
        total_viewers = sum(s.viewer_count for s in active_streams)

        # Count streams by token
        token_counts = {}
        for stream in active_streams:
            token_counts[stream.token_name] = token_counts.get(stream.token_name, 0) + 1

        return {
            "total_streams": len(self.streams),
            "active_streams": len(active_streams),
            "total_viewers": total_viewers,
            "last_refresh": self.last_fetch.isoformat() if self.last_fetch else None,
            "top_tokens": sorted(
                token_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
        }