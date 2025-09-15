"""
Logging Configuration Module

Sets up structured logging for the PumpRoulette application with
appropriate formatters, handlers, and log levels.
"""

import logging
import sys
from pathlib import Path
from typing import Optional

from config.settings import settings


def setup_logging() -> None:
    """
    Configure the logging system for the application.

    Sets up console and file handlers with appropriate formatters
    based on the application settings.
    """
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

    # Remove default handlers
    root_logger.handlers = []

    # Create formatter
    formatter = logging.Formatter(
        settings.LOG_FORMAT,
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    root_logger.addHandler(console_handler)

    # File handler (if configured)
    if settings.log_file_path:
        file_handler = logging.FileHandler(settings.log_file_path)
        file_handler.setFormatter(formatter)
        file_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
        root_logger.addHandler(file_handler)

    # Set specific log levels for third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.INFO)

    # Silence WebSocket related logs
    logging.getLogger("socketio").setLevel(logging.ERROR)
    logging.getLogger("socketio.client").setLevel(logging.ERROR)
    logging.getLogger("engineio").setLevel(logging.ERROR)
    logging.getLogger("engineio.client").setLevel(logging.ERROR)
    logging.getLogger("websocket").setLevel(logging.ERROR)

    # Silence pump.fun WebSocket trade logs
    logging.getLogger("services.pump_websocket_client").setLevel(logging.WARNING)

    # Log initial message
    root_logger.info(f"Logging initialized - Level: {settings.LOG_LEVEL}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name.

    Args:
        name (str): The name for the logger (typically __name__)

    Returns:
        logging.Logger: Configured logger instance
    """
    return logging.getLogger(name)