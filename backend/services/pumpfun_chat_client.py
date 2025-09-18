"""
Pump.fun Chat Client

WebSocket client for sending messages to pump.fun token chat rooms.
Based on Socket.IO protocol implementation.
"""

import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any
import websocket
import threading
from queue import Queue

logger = logging.getLogger(__name__)


class PumpFunChatClient:
    """
    Client for connecting to pump.fun chat rooms via WebSocket.
    Implements Socket.IO protocol for message exchange.
    """

    # WebSocket configuration
    WS_URL = "wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket"

    # Socket.IO protocol constants
    PACKET_OPEN = "0"
    PACKET_MESSAGE = "4"
    PACKET_PING = "2"
    PACKET_PONG = "3"

    def __init__(self, token_address: str, username: str = "PumpRoulette"):
        """
        Initialize the chat client.

        Args:
            token_address: The token mint address (chat room ID)
            username: Username to display in chat
        """
        self.token_address = token_address
        self.username = username
        self.ws = None
        self.connected = False
        self.message_queue = Queue()
        self.ping_thread = None
        self.ws_thread = None

        # Socket.IO session
        self.sid = None

    def _on_open(self, ws):
        """Handle WebSocket connection open."""
        logger.info(f"WebSocket connected to pump.fun for token {self.token_address}")

    def _on_message(self, ws, message):
        """
        Handle incoming WebSocket messages.

        Socket.IO protocol:
        - 0: Engine.IO open
        - 40: Socket.IO connect
        - 42: Socket.IO event
        - 2: Ping
        - 3: Pong
        """
        if not message:
            return

        packet_type = message[0] if message else ""

        if packet_type == "0":
            # Engine.IO handshake
            try:
                data = json.loads(message[1:])
                self.sid = data.get("sid")
                logger.debug(f"Received handshake, SID: {self.sid}")

                # Send Socket.IO connect
                self._send_connect()

            except json.JSONDecodeError:
                logger.error(f"Failed to parse handshake: {message}")

        elif packet_type == "4":
            # Socket.IO message
            if message.startswith("40"):
                # Socket.IO connected
                logger.info("Socket.IO connected successfully")
                self.connected = True

                # Join room
                self._join_room()

            elif message.startswith("42"):
                # Socket.IO event
                try:
                    event_data = json.loads(message[2:])
                    self._handle_event(event_data)
                except json.JSONDecodeError:
                    logger.debug(f"Received non-JSON event: {message}")

        elif packet_type == "2":
            # Ping - respond with pong
            ws.send("3")
            logger.debug("Responded to ping with pong")

    def _on_error(self, ws, error):
        """Handle WebSocket errors."""
        logger.error(f"WebSocket error: {error}")
        self.connected = False

    def _on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close."""
        logger.info(f"WebSocket closed: {close_status_code} - {close_msg}")
        self.connected = False

    def _send_connect(self):
        """Send Socket.IO connect packet."""
        self.ws.send("40")

    def _join_room(self):
        """Join the token's chat room."""
        join_message = [
            "join",
            {
                "roomId": self.token_address,
                "username": self.username
            }
        ]

        packet = f"42{json.dumps(join_message)}"
        self.ws.send(packet)
        logger.info(f"Sent join request for room {self.token_address}")

    def _handle_event(self, event_data):
        """
        Handle Socket.IO events.

        Args:
            event_data: Parsed event data
        """
        if isinstance(event_data, list) and len(event_data) > 0:
            event_name = event_data[0]

            if event_name == "joinedRoom":
                logger.info(f"Successfully joined room: {event_data[1] if len(event_data) > 1 else 'unknown'}")
            elif event_name == "messageHistory":
                logger.debug(f"Received message history: {len(event_data[1]) if len(event_data) > 1 else 0} messages")
            elif event_name == "newMessage":
                if len(event_data) > 1:
                    logger.debug(f"New message in chat: {event_data[1]}")
            else:
                logger.debug(f"Received event: {event_name}")

    def _ping_loop(self):
        """Send periodic pings to keep connection alive."""
        while self.connected:
            try:
                time.sleep(25)  # Send ping every 25 seconds
                if self.ws and self.connected:
                    self.ws.send("2")
                    logger.debug("Sent ping")
            except Exception as e:
                logger.error(f"Ping error: {e}")
                break

    def connect(self):
        """
        Connect to the pump.fun chat WebSocket.

        Returns:
            bool: True if connected successfully
        """
        try:
            # WebSocket headers - NO COOKIES NEEDED FOR READING MESSAGES
            headers = {
                "Host": "livechat.pump.fun",
                "Connection": "Upgrade",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                "Upgrade": "websocket",
                "Origin": "https://pump.fun",
                "Sec-WebSocket-Version": "13",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
            }

            # Create WebSocket connection
            self.ws = websocket.WebSocketApp(
                self.WS_URL,
                header=headers,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close
            )

            # Run WebSocket in a separate thread
            self.ws_thread = threading.Thread(target=self.ws.run_forever)
            self.ws_thread.daemon = True
            self.ws_thread.start()

            # Wait for connection
            timeout = 10
            start_time = time.time()
            while not self.connected and (time.time() - start_time) < timeout:
                time.sleep(0.5)

            if self.connected:
                # Start ping thread
                self.ping_thread = threading.Thread(target=self._ping_loop)
                self.ping_thread.daemon = True
                self.ping_thread.start()

                logger.info("Successfully connected to pump.fun chat")
                return True
            else:
                logger.error("Failed to connect within timeout")
                return False

        except Exception as e:
            logger.error(f"Connection error: {e}")
            return False

    def send_message(self, message: str) -> bool:
        """
        Send a message to the chat room.

        Args:
            message: The message text to send

        Returns:
            bool: True if message was sent successfully
        """
        if not self.connected:
            logger.error("Not connected to chat")
            return False

        try:
            # Create message event
            message_event = [
                "sendMessage",
                {
                    "roomId": self.token_address,
                    "message": message,
                    "username": self.username
                }
            ]

            # Send as Socket.IO event
            packet = f"42{json.dumps(message_event)}"
            self.ws.send(packet)

            logger.info(f"Sent message to {self.token_address}: {message}")
            return True

        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False

    def disconnect(self):
        """Disconnect from the chat room."""
        if self.ws:
            self.connected = False
            self.ws.close()
            logger.info("Disconnected from pump.fun chat")

    async def send_message_async(self, message: str) -> bool:
        """
        Async wrapper for sending messages.

        Args:
            message: The message text to send

        Returns:
            bool: True if message was sent successfully
        """
        return await asyncio.get_event_loop().run_in_executor(None, self.send_message, message)


# Example usage
if __name__ == "__main__":
    # Test token
    TEST_TOKEN = "7wFTYNZPAK7WbzSR8EhfmosaDb7jTL7wDnWjGAXP68jN"

    # Create client
    client = PumpFunChatClient(TEST_TOKEN, "TestBot")

    # Connect
    if client.connect():
        print("Connected! Sending test message...")

        # Send a test message
        time.sleep(2)  # Wait for room join
        client.send_message("🎤 Test message from PumpRoulette!")

        # Keep connection alive for a bit
        time.sleep(5)

        # Disconnect
        client.disconnect()
    else:
        print("Failed to connect")