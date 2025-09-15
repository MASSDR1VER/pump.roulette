"""
Health Check Endpoints

Provides health and readiness checks for monitoring and load balancing.
"""

from fastapi import APIRouter, Request
from typing import Dict, Any
from datetime import datetime

from config.settings import settings

router = APIRouter()


@router.get("/live")
async def liveness_probe() -> Dict[str, str]:
    """
    Kubernetes liveness probe endpoint.

    Simple endpoint that returns 200 OK if the service is alive.
    Used by orchestrators to determine if the container should be restarted.

    Returns:
        Dict[str, str]: Basic liveness status
    """
    return {"status": "alive"}


@router.get("/ready")
async def readiness_probe(request: Request) -> Dict[str, Any]:
    """
    Kubernetes readiness probe endpoint.

    Checks if the service is ready to accept traffic by verifying
    all critical components are operational.

    Args:
        request (Request): The FastAPI request object

    Returns:
        Dict[str, Any]: Readiness status and component health
    """
    # Check critical components
    stream_manager_ready = hasattr(request.app.state, 'stream_manager')
    websocket_manager_ready = hasattr(request.app.state, 'websocket_manager')

    all_ready = stream_manager_ready and websocket_manager_ready

    return {
        "ready": all_ready,
        "components": {
            "stream_manager": stream_manager_ready,
            "websocket_manager": websocket_manager_ready
        }
    }


@router.get("/detailed")
async def detailed_health(request: Request) -> Dict[str, Any]:
    """
    Detailed health check with component statuses and metrics.

    Provides comprehensive health information for monitoring dashboards.

    Args:
        request (Request): The FastAPI request object

    Returns:
        Dict[str, Any]: Detailed health status and metrics
    """
    health_data = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "environment": "production" if settings.is_production else "development",
        "components": {}
    }

    # Check StreamManager
    if hasattr(request.app.state, 'stream_manager'):
        stream_manager = request.app.state.stream_manager
        health_data["components"]["stream_manager"] = {
            "status": "operational",
            "active_streams": len(stream_manager.get_active_streams()),
            "last_refresh": stream_manager.last_fetch.isoformat() if stream_manager.last_fetch else None
        }
    else:
        health_data["components"]["stream_manager"] = {
            "status": "not_initialized"
        }

    # Check WebSocketManager
    if hasattr(request.app.state, 'websocket_manager'):
        ws_manager = request.app.state.websocket_manager
        health_data["components"]["websocket_manager"] = {
            "status": "operational",
            "active_connections": len(ws_manager.connections),
            "active_rooms": len(ws_manager.rooms)
        }
    else:
        health_data["components"]["websocket_manager"] = {
            "status": "not_initialized"
        }

    # Overall status
    all_operational = all(
        comp.get("status") == "operational"
        for comp in health_data["components"].values()
    )
    health_data["status"] = "healthy" if all_operational else "degraded"

    return health_data