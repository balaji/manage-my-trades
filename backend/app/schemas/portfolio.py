"""
Portfolio management schemas for API requests and responses.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class PortfolioCreate(BaseModel):
    """Schema for creating a new portfolio."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    portfolio_type: str = Field(default="paper")  # paper, live, backtest
    initial_capital: float = Field(gt=0, default=10000.0)
    currency: str = Field(default="USD", max_length=10)

    @field_validator("portfolio_type")
    @classmethod
    def validate_portfolio_type(cls, v: str) -> str:
        valid = {"paper", "live", "backtest"}
        if v not in valid:
            raise ValueError(f"portfolio_type must be one of {sorted(valid)}")
        return v


class PortfolioUpdate(BaseModel):
    """Schema for partially updating a portfolio."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PortfolioPositionCreate(BaseModel):
    """Schema for adding or updating a position within a portfolio."""

    symbol: str = Field(..., min_length=1, max_length=20)
    quantity: float = Field(..., gt=0)
    avg_entry_price: float = Field(..., gt=0)
    cost_basis: float = Field(..., gt=0)
    current_price: Optional[float] = None
    side: str = Field(default="long")  # long, short

    @field_validator("side")
    @classmethod
    def validate_side(cls, v: str) -> str:
        if v not in {"long", "short"}:
            raise ValueError("side must be 'long' or 'short'")
        return v

    @field_validator("symbol")
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        return v.upper()


class PortfolioPositionResponse(BaseModel):
    """Response schema for a portfolio position."""

    id: int
    portfolio_id: int
    symbol: str
    quantity: float
    avg_entry_price: float
    current_price: Optional[float]
    market_value: Optional[float]
    cost_basis: float
    unrealized_pnl: Optional[float]
    unrealized_pnl_pct: Optional[float]
    weight: Optional[float]
    side: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioSnapshotResponse(BaseModel):
    """Response schema for a portfolio equity snapshot."""

    id: int
    portfolio_id: int
    timestamp: datetime
    equity: float
    cash: float
    positions_value: float
    daily_pnl: Optional[float]
    daily_pnl_pct: Optional[float]
    total_return: Optional[float]
    total_return_pct: Optional[float]
    positions_count: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioMetricsResponse(BaseModel):
    """Response schema for portfolio performance metrics."""

    id: int
    portfolio_id: int
    total_return: Optional[float]
    total_return_pct: Optional[float]
    sharpe_ratio: Optional[float]
    sortino_ratio: Optional[float]
    max_drawdown: Optional[float]
    max_drawdown_pct: Optional[float]
    win_rate: Optional[float]
    profit_factor: Optional[float]
    volatility: Optional[float]
    total_trades: Optional[int]
    calculated_at: Optional[datetime]
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioResponse(BaseModel):
    """Full portfolio response including positions and metrics."""

    id: int
    name: str
    description: Optional[str]
    portfolio_type: str
    initial_capital: float
    current_cash: float
    currency: str
    is_active: bool
    positions: List[PortfolioPositionResponse] = []
    metrics: Optional[PortfolioMetricsResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioListItem(BaseModel):
    """Lightweight portfolio summary for list responses."""

    id: int
    name: str
    portfolio_type: str
    initial_capital: float
    current_cash: float
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioListResponse(BaseModel):
    """Response schema for listing portfolios."""

    portfolios: List[PortfolioListItem]
    total: int
