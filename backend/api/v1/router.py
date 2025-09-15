"""
Main API Router for Version 1

This module aggregates all API endpoints and defines the routing structure
for the PumpRoulette API v1.
"""

from fastapi import APIRouter

from .endpoints import streams_v2 as streams, chat_v2 as chat, auth, health, livestream, audio

# Create the main API router
api_router = APIRouter()

# Include all endpoint routers with their respective prefixes
api_router.include_router(
    streams.router,
    prefix="/streams",
    tags=["streams"]
)

api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["chat"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["authentication"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"]
)

api_router.include_router(
    livestream.router,
    prefix="/livestream",
    tags=["livestream"]
)

api_router.include_router(
    audio.router,
    prefix="/audio",
    tags=["audio"]
)