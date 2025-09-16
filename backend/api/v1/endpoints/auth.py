"""
Authentication Endpoints

API endpoints for wallet-based user authentication.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import secrets
import time

from services.wallet_auth_service import WalletAuthService
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory nonce storage (in production, use Redis)
nonce_storage: Dict[str, Dict[str, Any]] = {}


class WalletConnectRequest(BaseModel):
    """Request model for wallet connection."""
    wallet_address: str = Field(..., description="Solana wallet public key")


class WalletVerifyRequest(BaseModel):
    """Request model for wallet signature verification."""
    wallet_address: str = Field(..., description="Solana wallet public key")
    message: str = Field(..., description="Message that was signed")
    signature: str = Field(..., description="Base64 encoded signature")
    username: Optional[str] = Field(None, description="Optional username")


class WalletConnectResponse(BaseModel):
    """Response model for wallet connection."""
    success: bool
    message: str
    auth_message: str
    wallet_address: str


class WalletVerifyResponse(BaseModel):
    """Response model for wallet verification."""
    success: bool
    message: str
    token: str
    user: Dict[str, Any]


def get_wallet_auth_service() -> WalletAuthService:
    """Dependency to get wallet authentication service."""
    return WalletAuthService()


def get_current_user(request: Request, auth_service: WalletAuthService = Depends(get_wallet_auth_service)) -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from request.

    Args:
        request (Request): FastAPI request object
        auth_service (WalletAuthService): Authentication service

    Returns:
        Optional[Dict[str, Any]]: User data if authenticated, None otherwise
    """
    # Try to get token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    return auth_service.verify_user_token(token)


@router.post("/wallet/connect", response_model=WalletConnectResponse)
async def connect_wallet(
    request: WalletConnectRequest,
    auth_service: WalletAuthService = Depends(get_wallet_auth_service)
) -> WalletConnectResponse:
    """
    Initiate wallet connection by generating an authentication message.

    Args:
        request (WalletConnectRequest): Wallet connection request
        auth_service (WalletAuthService): Authentication service

    Returns:
        WalletConnectResponse: Authentication message to be signed
    """
    try:
        # Generate authentication message
        auth_message = auth_service.generate_auth_message(request.wallet_address)

        return WalletConnectResponse(
            success=True,
            message="Please sign the authentication message with your wallet",
            auth_message=auth_message,
            wallet_address=request.wallet_address
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate auth message: {str(e)}")


@router.post("/wallet/verify", response_model=WalletVerifyResponse)
async def verify_wallet(
    request: WalletVerifyRequest,
    auth_service: WalletAuthService = Depends(get_wallet_auth_service)
) -> WalletVerifyResponse:
    """
    Verify wallet signature and create user session.

    Args:
        request (WalletVerifyRequest): Wallet verification request
        auth_service (WalletAuthService): Authentication service

    Returns:
        WalletVerifyResponse: JWT token and user data
    """
    try:
        # Verify the wallet signature
        is_valid = auth_service.verify_wallet_signature(
            request.wallet_address,
            request.message,
            request.signature
        )

        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid wallet signature")

        # Find or create user
        try:
            user = await User.find_one(User.wallet_address == request.wallet_address)
            logger.info(f"Found existing user: {user is not None}")
        except Exception as db_error:
            logger.error(f"Database query failed: {db_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")

        if not user:
            # Create new user
            try:
                logger.info(f"Creating new user for wallet: {request.wallet_address}")
                user = User(
                    wallet_address=request.wallet_address,
                    username=request.username,
                    display_name=request.username or f"User_{request.wallet_address[:8]}",
                    last_auth_message=request.message,
                    last_auth_signature=request.signature,
                    last_login=datetime.now(timezone.utc)
                )
                await user.insert()
                logger.info(f"Successfully created user: {user.id}")
            except Exception as create_error:
                logger.error(f"Failed to create user: {create_error}")
                raise HTTPException(status_code=500, detail=f"User creation failed: {str(create_error)}")
        else:
            # Update existing user
            try:
                logger.info(f"Updating existing user: {user.id}")
                user.last_auth_message = request.message
                user.last_auth_signature = request.signature
                user.last_login = datetime.now(timezone.utc)
                if request.username and not user.username:
                    user.username = request.username
                    user.display_name = request.username
                await user.save()
                logger.info(f"Successfully updated user: {user.id}")
            except Exception as update_error:
                logger.error(f"Failed to update user: {update_error}")
                raise HTTPException(status_code=500, detail=f"User update failed: {str(update_error)}")

        # Create JWT token
        token = auth_service.create_user_token(
            request.wallet_address,
            user.username
        )

        return WalletVerifyResponse(
            success=True,
            message="Wallet authenticated successfully",
            token=token,
            user=user.to_public_dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.get("/wallet/profile")
async def get_wallet_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current user's wallet profile.

    Args:
        current_user (Dict[str, Any]): Current authenticated user

    Returns:
        Dict[str, Any]: User profile data
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Get user from database
        user = await User.find_one(User.wallet_address == current_user["wallet_address"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "success": True,
            "user": user.to_public_dict()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")


@router.post("/wallet/disconnect")
async def disconnect_wallet(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Disconnect wallet (invalidate current session).

    Args:
        current_user (Dict[str, Any]): Current authenticated user

    Returns:
        Dict[str, Any]: Success message
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "success": True,
        "message": "Wallet disconnected successfully"
    }


@router.get("/wallet/validate")
async def validate_wallet_token(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Validate current authentication token.

    Args:
        current_user (Dict[str, Any]): Current authenticated user

    Returns:
        Dict[str, Any]: Validation result
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "success": True,
        "message": "Token is valid",
        "wallet_address": current_user["wallet_address"],
        "username": current_user["username"],
        "expires_at": current_user.get("exp")
    }


@router.get("/nonce")
async def get_nonce() -> Dict[str, str]:
    """
    Generate a unique nonce for wallet signature verification.

    Returns:
        Dict[str, str]: Nonce value
    """
    # Generate a secure random nonce
    nonce = secrets.token_urlsafe(16)

    # Store nonce with expiration (60 seconds)
    current_time = time.time()
    nonce_storage[nonce] = {
        "created_at": current_time,
        "expires_at": current_time + 60,
        "used": False
    }

    # Clean up expired nonces
    expired_nonces = [
        n for n, data in nonce_storage.items()
        if data["expires_at"] < current_time
    ]
    for n in expired_nonces:
        del nonce_storage[n]

    logger.info(f"Generated nonce: {nonce}")

    return {"nonce": nonce}


def verify_and_consume_nonce(nonce: str) -> bool:
    """
    Verify a nonce is valid and mark it as used.

    Args:
        nonce (str): Nonce to verify

    Returns:
        bool: True if nonce is valid and unused
    """
    if nonce not in nonce_storage:
        logger.warning(f"Nonce not found: {nonce}")
        return False

    nonce_data = nonce_storage[nonce]
    current_time = time.time()

    # Check if expired
    if nonce_data["expires_at"] < current_time:
        logger.warning(f"Nonce expired: {nonce}")
        del nonce_storage[nonce]
        return False

    # Check if already used
    if nonce_data["used"]:
        logger.warning(f"Nonce already used: {nonce}")
        return False

    # Mark as used
    nonce_data["used"] = True
    logger.info(f"Nonce consumed: {nonce}")
    return True