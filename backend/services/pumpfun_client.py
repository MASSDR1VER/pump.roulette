"""
Pump.fun WebSocket Client

Connects to Pump.fun WebSocket API to receive real-time token and trade data.
Based on reverse-engineered API from frontend-api-v3.pump.fun.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Callable
import socketio
from models.token import Token
from models.trade import Trade
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)


class PumpFunClient:
    """
    WebSocket client for Pump.fun real-time data stream.

    Connects to the unofficial Pump.fun WebSocket API to receive:
    - New token creation events
    - Trade events
    - Token metadata updates
    """

    def __init__(self, db_url: str = "mongodb://localhost:27017/pumproulette"):
        """
        Initialize Pump.fun WebSocket client.

        Args:
            db_url (str): MongoDB connection URL
        """
        self.ws_url = "https://frontend-api-v3.pump.fun"
        self.sio = socketio.AsyncClient(
            logger=True,
            engineio_logger=True,
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=1,
            reconnection_delay_max=5
        )

        self.db_url = db_url
        self.db_client: Optional[AsyncIOMotorClient] = None
        self.is_connected = False
        self.active_tokens: Dict[str, Token] = {}  # Cache of active tokens

        # Register event handlers
        self.setup_handlers()

    def setup_handlers(self):
        """Set up Socket.IO event handlers."""

        @self.sio.on('connect')
        async def on_connect():
            """Handle connection event."""
            logger.info("Connected to Pump.fun WebSocket")
            self.is_connected = True

        @self.sio.on('disconnect')
        async def on_disconnect():
            """Handle disconnection event."""
            logger.warning("Disconnected from Pump.fun WebSocket")
            self.is_connected = False

        @self.sio.on('tradeCreated')
        async def on_trade_created(data):
            """
            Handle new trade event.

            This event contains both trade data and token metadata.
            """
            try:
                await self.process_trade(data)
            except Exception as e:
                logger.error(f"Error processing trade: {e}")

        @self.sio.on('*')
        async def catch_all(event, data):
            """Catch all events for debugging."""
            logger.debug(f"Received event: {event}, data: {data}")

    async def initialize_db(self):
        """Initialize MongoDB connection and Beanie ODM."""
        try:
            self.db_client = AsyncIOMotorClient(self.db_url)
            database = self.db_client.pumproulette

            # Initialize Beanie with document models
            await init_beanie(
                database=database,
                document_models=[Token, Trade]
            )

            logger.info("MongoDB initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB: {e}")
            raise

    async def connect(self):
        """Connect to Pump.fun WebSocket and MongoDB."""
        try:
            # Initialize database
            await self.initialize_db()

            # Connect to WebSocket
            logger.info(f"Connecting to Pump.fun WebSocket at {self.ws_url}")
            await self.sio.connect(
                self.ws_url,
                transports=['websocket'],
                socketio_path='/socket.io/'
            )

            # Send initial handshake
            await self.sio.emit('message', '40')

            logger.info("Successfully connected to Pump.fun")

        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise

    async def disconnect(self):
        """Disconnect from WebSocket and close database connection."""
        try:
            if self.sio.connected:
                await self.sio.disconnect()

            if self.db_client:
                self.db_client.close()

            logger.info("Disconnected from all services")
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")

    async def process_trade(self, data: Dict[str, Any]):
        """
        Process incoming trade data.

        Args:
            data (Dict[str, Any]): Trade data from WebSocket
        """
        try:
            # Extract token data
            is_live = data.get("is_currently_live", False)

            # Log if this token has a live stream
            if is_live:
                logger.info(f"🔴 LIVE STREAM DETECTED: {data.get('name')} ({data.get('mint')})")

            token_data = {
                "mint": data["mint"],
                "symbol": data.get("symbol", ""),
                "name": data.get("name", ""),
                "description": data.get("description", ""),
                "image_uri": data.get("image_uri", ""),
                "metadata_uri": data.get("metadata_uri", ""),
                "bonding_curve": data.get("bonding_curve", ""),
                "virtual_sol_reserves": data.get("virtual_sol_reserves", 0),
                "virtual_token_reserves": data.get("virtual_token_reserves", 0),
                "total_supply": data.get("total_supply", 0),
                "market_cap": data.get("market_cap", 0.0),
                "usd_market_cap": data.get("usd_market_cap", 0.0),
                "creator": data.get("creator", ""),
                "created_timestamp": datetime.fromtimestamp(
                    data.get("created_timestamp", 0) / 1000
                ),
                "is_currently_live": is_live,
                "signature": data.get("signature", "")  # Store trade signature
            }

            # Update or create token
            token = await Token.find_one(Token.mint == token_data["mint"])
            if not token:
                token = Token(**token_data)
                await token.insert()
                logger.info(f"New token discovered: {token.symbol} ({token.mint})")
            else:
                # Update market data
                token.market_cap = token_data["market_cap"]
                token.usd_market_cap = token_data["usd_market_cap"]
                token.virtual_sol_reserves = token_data["virtual_sol_reserves"]
                token.virtual_token_reserves = token_data["virtual_token_reserves"]
                token.is_currently_live = token_data["is_currently_live"]
                token.signature = token_data["signature"]  # Update signature
                token.updated_at = datetime.utcnow()
                token.trade_count += 1
                await token.save()

            # Store in active tokens cache
            self.active_tokens[token.mint] = token

            # Create trade record
            trade = Trade(
                signature=data["signature"],
                mint=data["mint"],
                sol_amount=data["sol_amount"],
                token_amount=data["token_amount"],
                is_buy=data["is_buy"],
                user=data["user"],
                slot=data.get("slot", 0),
                tx_index=data.get("tx_index", 0),
                timestamp=datetime.fromtimestamp(data.get("timestamp", 0)),
                virtual_sol_reserves=data["virtual_sol_reserves"],
                virtual_token_reserves=data["virtual_token_reserves"]
            )
            await trade.insert()

            logger.debug(
                f"Trade processed: {'BUY' if trade.is_buy else 'SELL'} "
                f"{token.symbol} by {trade.user[:8]}..."
            )

        except Exception as e:
            logger.error(f"Error processing trade data: {e}")
            logger.error(f"Data: {data}")

    async def get_active_tokens(self, limit: int = 50) -> list[Token]:
        """
        Get currently active tokens sorted by market cap.

        Args:
            limit (int): Maximum number of tokens to return

        Returns:
            list[Token]: List of active tokens
        """
        tokens = await Token.find(
            Token.is_currently_live == True
        ).sort(-Token.usd_market_cap).limit(limit).to_list()

        return tokens

    async def get_live_streaming_tokens(self, limit: int = 50) -> list[Token]:
        """
        Get only tokens that have active live streams.

        Args:
            limit (int): Maximum number of tokens to return

        Returns:
            list[Token]: List of tokens with live streams
        """
        # Filter for tokens that are marked as having live streams
        # In Pump.fun, is_currently_live indicates if there's an active stream
        tokens = await Token.find(
            Token.is_currently_live == True
        ).sort(-Token.trade_count).limit(limit).to_list()

        # Additional filtering - only return tokens with recent activity
        live_tokens = []
        for token in tokens:
            # Check if token has recent trades (within last 5 minutes)
            if token.last_trade_timestamp:
                time_diff = datetime.utcnow() - token.last_trade_timestamp
                if time_diff.total_seconds() < 300:  # 5 minutes
                    live_tokens.append(token)

        return live_tokens

    async def get_token_stream_url(self, mint: str) -> str:
        """
        Generate Pump.fun stream URL for a token.

        Args:
            mint (str): Token mint address

        Returns:
            str: Pump.fun coin page URL (embeddable iframe URL)
        """
        # Pump.fun uses /coin/ for the actual page
        # For embedding, we might need a special embed URL
        # Try different formats:

        # Option 1: Direct coin page (might not work in iframe due to X-Frame-Options)
        # return f"https://pump.fun/coin/{mint}"

        # Option 2: Potential embed endpoint (needs testing)
        # return f"https://pump.fun/embed/{mint}"

        # Option 3: Stream-specific endpoint
        # return f"https://pump.fun/stream/{mint}"

        # For now, use the standard coin page
        return f"https://pump.fun/coin/{mint}"

    async def get_random_pair(self) -> Optional[tuple[Token, Token]]:
        """
        Get a random pair of active tokens.

        Returns:
            Optional[tuple[Token, Token]]: Pair of tokens or None if not enough tokens
        """
        # Get active tokens
        tokens = await self.get_active_tokens(limit=20)

        if len(tokens) < 2:
            logger.warning("Not enough active tokens for pairing")
            return None

        # Select two random tokens
        import random
        pair = random.sample(tokens, 2)
        return (pair[0], pair[1])

    async def run(self):
        """Run the WebSocket client indefinitely."""
        try:
            await self.connect()

            # Keep the connection alive
            while True:
                if not self.is_connected:
                    logger.warning("Connection lost, attempting to reconnect...")
                    await self.connect()

                await asyncio.sleep(1)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
        finally:
            await self.disconnect()


async def main():
    """Main function to run the Pump.fun client."""
    client = PumpFunClient()
    await client.run()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    asyncio.run(main())