"""
Application Configuration Settings

This module manages all configuration settings for the PumpRoulette backend,
including environment variables, API keys, database connections, and service URLs.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path


class Settings(BaseSettings):
    """
    Main settings class that loads configuration from environment variables.

    All settings can be overridden using environment variables or a .env file.
    Variable names in the environment should match the attribute names (case-insensitive).
    """

    # Application settings
    APP_NAME: str = "PumpRoulette"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://pumproulette.com"
    ]

    # MongoDB configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "pumproulette"

    # Redis configuration for caching and sessions
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_POOL_SIZE: int = 10

    # Pump.fun WebSocket configuration (reverse-engineered)
    PUMP_FUN_WS_URL: str = "https://frontend-api-v3.pump.fun"
    PUMP_FUN_BASE_URL: str = "https://pump.fun"
    PUMP_FUN_REFRESH_INTERVAL: int = 30  # seconds

    # WebSocket configuration
    WEBSOCKET_MESSAGE_LIMIT: int = 500  # characters
    WEBSOCKET_RATE_LIMIT: int = 10  # messages per minute
    WEBSOCKET_MAX_CONNECTIONS: int = 1000

    # Chat moderation settings
    ENABLE_CHAT_MODERATION: bool = True
    BLOCKED_WORDS_FILE: str = "config/blocked_words.txt"
    MAX_CHAT_HISTORY: int = 100  # messages per room

    # Wallet integration
    SUPPORTED_WALLETS: List[str] = ["phantom", "metamask", "walletconnect"]
    REQUIRE_WALLET_FOR_CHAT: bool = False

    # Logging configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE: Optional[str] = "logs/pumproulette.log"

    # Stream pairing configuration
    MIN_ACTIVE_STREAMS: int = 2
    STREAM_PAIR_CACHE_TTL: int = 60  # seconds
    DEFAULT_STREAM_THUMBNAIL: str = "/static/default-stream.jpg"

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds

    # LiveKit configuration for audio rooms
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # Pump.fun API authentication for notifications
    PUMPFUN_AUTH_TOKEN: str = ""  # Auth token for sending pump.fun replies
    PUMPFUN_CHAT_MESSAGE: str = "🎤 Voice battle invite! Check comments for link"
    PUMPFUN_COMMENT_MESSAGE: str = "🎤 Join voice battle: {link}"

    class Config:
        """Pydantic configuration class"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def get_mongodb_url(self) -> str:
        """
        Constructs the MongoDB URL from environment variables or returns the default.

        Returns:
            str: The complete MongoDB connection URL
        """
        return self.MONGODB_URL

    def get_redis_url(self) -> str:
        """
        Constructs the Redis URL from environment variables or returns the default.

        Returns:
            str: The complete Redis connection URL
        """
        return self.REDIS_URL

    @property
    def is_production(self) -> bool:
        """
        Determines if the application is running in production mode.

        Returns:
            bool: True if in production, False otherwise
        """
        return not self.DEBUG

    @property
    def log_file_path(self) -> Optional[Path]:
        """
        Gets the log file path if logging to file is enabled.

        Returns:
            Optional[Path]: Path object for the log file or None
        """
        if self.LOG_FILE:
            path = Path(self.LOG_FILE)
            path.parent.mkdir(parents=True, exist_ok=True)
            return path
        return None


# Create a singleton instance of settings
settings = Settings()