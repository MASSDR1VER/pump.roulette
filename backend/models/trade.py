"""
Trade Model

MongoDB model for storing trade events from Pump.fun.
"""

from datetime import datetime
from beanie import Document, Indexed, Link
from pydantic import Field
from typing import Optional


class Trade(Document):
    """
    Trade document model for MongoDB.

    Stores trade events received from Pump.fun WebSocket stream.
    """

    # Transaction details
    signature: Indexed(str, unique=True) = Field(..., description="Solana transaction signature")
    mint: Indexed(str) = Field(..., description="Token mint address")

    # Trade amounts
    sol_amount: int = Field(..., description="SOL amount in lamports")
    token_amount: int = Field(..., description="Token amount")
    is_buy: bool = Field(..., description="Whether this is a buy (true) or sell (false)")

    # User info
    user: str = Field(..., description="Trader wallet address")

    # Blockchain data
    slot: int = Field(..., description="Solana slot number")
    tx_index: int = Field(..., description="Transaction index in block")
    timestamp: datetime = Field(..., description="Trade timestamp")

    # Market state at trade time
    virtual_sol_reserves: int = Field(..., description="Virtual SOL reserves after trade")
    virtual_token_reserves: int = Field(..., description="Virtual token reserves after trade")

    # Tracking
    received_at: datetime = Field(default_factory=datetime.utcnow, description="When we received this trade")

    class Settings:
        """Beanie document settings"""
        name = "trades"
        indexes = [
            "mint",
            "user",
            "timestamp",
            "is_buy",
            [("mint", 1), ("timestamp", -1)]  # Compound index for efficient queries
        ]

    class Config:
        """Pydantic config"""
        json_schema_extra = {
            "example": {
                "signature": "2B2ncbdCYbuEPgSpFxpXCpfMJ65ikWi5xfvNjaCj2hPjvncoCSNegTDkQa4dcdCooxaWsu8qJ2ScqHHgczq2bBiu",
                "mint": "6XZvbJBKrD785ff49XeV91sg75pgjpF6WikKJUuppump",
                "sol_amount": 444376895,
                "token_amount": 9981312192314,
                "is_buy": False,
                "user": "CC9zRJY6fZV2VY45UaFAMZqa92LiC1ZFuMdLeZM9RkTk",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }