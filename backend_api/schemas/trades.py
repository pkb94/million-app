"""backend_api/schemas/trades.py — Accounts and holdings Pydantic models."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Accounts & Holdings ───────────────────────────────────────────────────────

class AccountCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    broker: Optional[str] = None
    currency: str = Field(default="USD", min_length=1)


class AccountOut(BaseModel):
    id: int
    name: str
    broker: Optional[str] = None
    currency: str
    created_at: Optional[datetime] = None


class HoldingUpsertRequest(BaseModel):
    symbol: str = Field(min_length=1)
    quantity: float
    avg_cost: Optional[float] = None


class HoldingOut(BaseModel):
    id: int
    account_id: int
    symbol: str
    quantity: float
    avg_cost: Optional[float] = None
    updated_at: Optional[datetime] = None
