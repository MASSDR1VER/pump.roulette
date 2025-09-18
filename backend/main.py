"""
PumpRoulette Backend Application
Main entry point for the FastAPI application that powers PumpRoulette.

This module initializes the FastAPI app, configures middleware, sets up routes,
and manages the WebSocket connections for real-time chat functionality.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import logging
from typing import AsyncGenerator
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from config.settings import settings
from api.v1.router import api_router
from services.websocket_manager import WebSocketManager
from services.stream_manager_v2 import StreamManager
from services.audio_room_service import AudioRoomService
from models.user import User
from utils.logger import setup_logging

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Manages the application lifecycle, handling startup and shutdown events.

    Args:
        app (FastAPI): The FastAPI application instance

    Yields:
        None: Control back to the application
    """
    # Startup
    logger.info("Starting PumpRoulette backend server...")

    # Initialize MongoDB and Beanie
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        database = client[settings.MONGODB_DB_NAME]

        # Initialize Beanie with User model
        await init_beanie(database=database, document_models=[User])
        logger.info("Database and Beanie initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    # Initialize services
    app.state.stream_manager = StreamManager()
    app.state.websocket_manager = WebSocketManager()
    app.state.audio_room_service = AudioRoomService()

    # Start background tasks
    await app.state.stream_manager.initialize()

    # Start cleanup task
    async def cleanup_task():
        """Periodic cleanup task to remove old tokens and mark inactive streams."""
        while True:
            try:
                await asyncio.sleep(300)  # Wait 5 minutes

                # Cleanup inactive streams
                inactive_count = await app.state.stream_manager.pump_client.cleanup_inactive_streams()
                if inactive_count > 0:
                    logger.info(f"Marked {inactive_count} streams as inactive")

                # Cleanup old tokens (older than 24 hours)
                deleted_count = await app.state.stream_manager.pump_client.cleanup_old_tokens(hours=24)
                if deleted_count > 0:
                    logger.info(f"Deleted {deleted_count} old tokens")

            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    app.state.cleanup_task = asyncio.create_task(cleanup_task())
    logger.info("Started periodic cleanup task")

    logger.info("PumpRoulette backend started successfully")

    yield

    # Shutdown
    logger.info("Shutting down PumpRoulette backend...")

    # Cancel cleanup task
    if hasattr(app.state, 'cleanup_task'):
        app.state.cleanup_task.cancel()
    await app.state.stream_manager.cleanup()
    await app.state.websocket_manager.cleanup()
    logger.info("PumpRoulette backend shutdown complete")


# Create FastAPI application instance
app = FastAPI(
    title="PumpRoulette API",
    description="Backend API for PumpRoulette - Random Pump.fun stream pairing platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """
    Root endpoint providing basic API information.

    Returns:
        dict: API status and version information
    """
    return {
        "name": "PumpRoulette API",
        "version": "1.0.0",
        "status": "operational",
        "documentation": "/docs"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancer checks.

    Returns:
        dict: Health status of the application
    """
    return {
        "status": "healthy",
        "services": {
            "stream_manager": "operational",
            "websocket": "operational",
            "database": "operational",
            "audio_room": "operational"
        }
    }


@app.get("/api/v1/audio/stream/{stream_pair_id}")
async def get_viewer_token_for_stream(stream_pair_id: str):
    """
    Get viewer token for listening to a stream pair's audio room.

    Args:
        stream_pair_id: The stream pair ID

    Returns:
        Viewer token and room information
    """
    audio_service = app.state.audio_room_service

    # Check if both streamers have joined
    has_joined = await audio_service.has_streamer_joined(stream_pair_id)
    if not has_joined:
        # Return 425 Too Early if streamers haven't joined yet
        from fastapi import HTTPException
        raise HTTPException(status_code=425, detail="Streamers have not joined yet")

    # Get viewer token and room info
    result = await audio_service.get_viewer_token_for_stream_pair(stream_pair_id)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No active audio room for this stream pair")

    return result


if __name__ == "__main__":
    """
    Run the application using Uvicorn ASGI server.
    This is for development purposes. In production, use a proper ASGI server.
    """
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info"
    )