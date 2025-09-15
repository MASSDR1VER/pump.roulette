"""
Token Model

MongoDB model for storing Pump.fun token data.
"""

from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class Token(Document):
    """
    Token document model for MongoDB.

    Stores information about tokens discovered from Pump.fun WebSocket stream.
    """

    # Token identifiers
    mint: Indexed(str, unique=True) = Field(..., description="Token's Solana mint address")
    symbol: str = Field(..., description="Token symbol (e.g., 'WIN')")
    name: str = Field(..., description="Token name")

    # Metadata
    description: Optional[str] = Field(None, description="Token description")
    image_uri: Optional[str] = Field(None, description="Token image IPFS URI")
    metadata_uri: Optional[str] = Field(None, description="Token metadata IPFS URI")
    video_uri: Optional[str] = Field(None, description="Token video URI")

    # Social links
    twitter: Optional[str] = Field(None, description="Twitter/X profile URL")
    telegram: Optional[str] = Field(None, description="Telegram group URL")
    website: Optional[str] = Field(None, description="Website URL")

    # Trading data
    bonding_curve: str = Field(..., description="Bonding curve address")
    virtual_sol_reserves: int = Field(..., description="Virtual SOL reserves")
    virtual_token_reserves: int = Field(..., description="Virtual token reserves")
    total_supply: int = Field(..., description="Total token supply")

    # Market data
    market_cap: float = Field(..., description="Market cap in SOL")
    usd_market_cap: float = Field(..., description="Market cap in USD")

    # Creator info
    creator: str = Field(..., description="Creator wallet address")
    created_timestamp: datetime = Field(..., description="Token creation timestamp")

    # Status
    is_currently_live: bool = Field(default=False, description="Whether token has live streaming")
    complete: bool = Field(default=False, description="Whether bonding curve is complete")
    signature: Optional[str] = Field(None, description="Trade signature from blockchain")
    last_trade_timestamp: Optional[datetime] = Field(None, description="Last trade timestamp")
    trade_count: int = Field(default=0, description="Total number of trades")

    # Additional market data
    sol_amount: Optional[int] = Field(None, description="SOL amount in last trade")
    token_amount: Optional[int] = Field(None, description="Token amount in last trade")
    price_change_24h: Optional[float] = Field(None, description="24h price change percentage")
    volume_24h: Optional[float] = Field(None, description="24h trading volume")
    holders: Optional[int] = Field(None, description="Number of token holders")
    reply_count: Optional[int] = Field(None, description="Number of replies")

    # Flags
    nsfw: bool = Field(default=False, description="NSFW content flag")
    is_trending: bool = Field(default=False, description="Trending status")
    is_verified: bool = Field(default=False, description="Verified status")
    show_name: bool = Field(default=True, description="Show name flag")

    # Creator details
    creator_username: Optional[str] = Field(None, description="Creator username")
    creator_profile_image: Optional[str] = Field(None, description="Creator profile image URL")

    # Tracking
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="When we discovered this token")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Last update time")

    class Settings:
        """Beanie document settings"""
        name = "tokens"
        indexes = [
            "symbol",
            "creator",
            "created_timestamp",
            "is_currently_live",
            "market_cap",
            "usd_market_cap"
        ]

    class Config:
        """Pydantic config"""
        json_schema_extra = {
            "example": {
                "mint": "6XZvbJBKrD785ff49XeV91sg75pgjpF6WikKJUuppump",
                "symbol": "WIN",
                "name": "PUMP FUN FOR THE WIN !!!!!",
                "description": "LETS SEE WHERE THIS TAKES US!",
                "market_cap": 42.54,
                "usd_market_cap": 10532.96,
                "creator": "7szQhDQDb9DGxJCqr9RHUxFXRGpsX3xH2s772hJqWSQt",
                "is_currently_live": True
            }
        }