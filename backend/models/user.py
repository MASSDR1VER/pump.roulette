"""
User Model

MongoDB model for storing wallet-authenticated users.
"""

from datetime import datetime, timezone
from typing import Optional, List
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class User(Document):
    """
    User document model for MongoDB.

    Stores information about wallet-authenticated users.
    """

    # Wallet identification
    wallet_address: str = Field(..., description="Solana wallet address")

    # User profile
    username: Optional[str] = Field(None, description="User chosen username")
    display_name: Optional[str] = Field(None, description="Display name for UI")
    profile_image: Optional[str] = Field(None, description="Profile image URL")
    bio: Optional[str] = Field(None, description="User bio/description")

    # Authentication
    last_auth_message: Optional[str] = Field(None, description="Last signed auth message")
    last_auth_signature: Optional[str] = Field(None, description="Last auth signature")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")

    # Audio preferences
    preferred_mic_device: Optional[str] = Field(None, description="Preferred microphone device ID")
    preferred_audio_device: Optional[str] = Field(None, description="Preferred audio output device ID")
    audio_enabled: bool = Field(default=True, description="Audio enabled by default")
    push_to_talk: bool = Field(default=False, description="Push-to-talk mode enabled")

    # Social features
    following: List[str] = Field(default_factory=list, description="List of wallet addresses being followed")
    followers: List[str] = Field(default_factory=list, description="List of follower wallet addresses")
    blocked_users: List[str] = Field(default_factory=list, description="List of blocked wallet addresses")

    # Activity tracking
    total_calls_made: int = Field(default=0, description="Total audio calls initiated")
    total_calls_joined: int = Field(default=0, description="Total audio calls joined")
    total_chat_messages: int = Field(default=0, description="Total chat messages sent")
    reputation_score: float = Field(default=0.0, description="User reputation score")

    # Status
    is_active: bool = Field(default=True, description="User account is active")
    is_verified: bool = Field(default=False, description="User is verified")
    is_premium: bool = Field(default=False, description="User has premium features")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Account creation time")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Last update time")

    class Settings:
        """Beanie document settings"""
        name = "users"
        indexes = [
            IndexModel([("wallet_address", ASCENDING)], unique=True),
            "username",
            "created_at",
            "last_login",
            "is_active",
            "reputation_score"
        ]

    def get_display_name(self) -> str:
        """
        Get the best display name for the user.

        Returns:
            str: Username if set, otherwise formatted wallet address
        """
        if self.username:
            return self.username
        if self.display_name:
            return self.display_name
        # Format wallet address for display
        return f"{self.wallet_address[:4]}...{self.wallet_address[-4:]}"

    def get_profile_image_url(self) -> str:
        """
        Get profile image URL, with fallback to generated avatar.

        Returns:
            str: Profile image URL
        """
        if self.profile_image:
            return self.profile_image

        # Generate avatar based on wallet address
        name = self.get_display_name()
        return f"https://ui-avatars.com/api/?name={name}&background=7DE2A1&color=000&size=64&rounded=true"

    def update_activity(self, activity_type: str) -> None:
        """
        Update user activity counters.

        Args:
            activity_type (str): Type of activity ('call_made', 'call_joined', 'chat_message')
        """
        if activity_type == "call_made":
            self.total_calls_made += 1
        elif activity_type == "call_joined":
            self.total_calls_joined += 1
        elif activity_type == "chat_message":
            self.total_chat_messages += 1

        self.updated_at = datetime.now(timezone.utc)

    def follow_user(self, wallet_address: str) -> bool:
        """
        Follow another user.

        Args:
            wallet_address (str): Wallet address of user to follow

        Returns:
            bool: True if successfully followed, False if already following
        """
        if wallet_address not in self.following and wallet_address != self.wallet_address:
            self.following.append(wallet_address)
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def unfollow_user(self, wallet_address: str) -> bool:
        """
        Unfollow a user.

        Args:
            wallet_address (str): Wallet address of user to unfollow

        Returns:
            bool: True if successfully unfollowed, False if not following
        """
        if wallet_address in self.following:
            self.following.remove(wallet_address)
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def block_user(self, wallet_address: str) -> bool:
        """
        Block a user.

        Args:
            wallet_address (str): Wallet address of user to block

        Returns:
            bool: True if successfully blocked, False if already blocked
        """
        if wallet_address not in self.blocked_users and wallet_address != self.wallet_address:
            self.blocked_users.append(wallet_address)
            # Remove from following if currently following
            if wallet_address in self.following:
                self.following.remove(wallet_address)
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def unblock_user(self, wallet_address: str) -> bool:
        """
        Unblock a user.

        Args:
            wallet_address (str): Wallet address of user to unblock

        Returns:
            bool: True if successfully unblocked, False if not blocked
        """
        if wallet_address in self.blocked_users:
            self.blocked_users.remove(wallet_address)
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def to_public_dict(self) -> dict:
        """
        Convert user to public dictionary (safe for API responses).

        Returns:
            dict: Public user data
        """
        return {
            "wallet_address": self.wallet_address,
            "username": self.username,
            "display_name": self.get_display_name(),
            "profile_image": self.get_profile_image_url(),
            "bio": self.bio,
            "is_verified": self.is_verified,
            "is_premium": self.is_premium,
            "reputation_score": self.reputation_score,
            "total_calls_made": self.total_calls_made,
            "total_calls_joined": self.total_calls_joined,
            "created_at": self.created_at.isoformat(),
            "follower_count": len(self.followers),
            "following_count": len(self.following)
        }

    class Config:
        """Pydantic config"""
        json_schema_extra = {
            "example": {
                "wallet_address": "7szQhDQDb9DGxJCqr9RHUxFXRGpsX3xH2s772hJqWSQt",
                "username": "crypto_trader",
                "display_name": "Crypto Trader",
                "bio": "Pump.fun enthusiast and trader",
                "is_verified": True,
                "reputation_score": 4.5
            }
        }