"""Pydantic schemas for backtest endpoints."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date


class BacktestCreate(BaseModel):
    """Schema for creating a backtest."""

    strategy_id: int
    name: str
    symbols: List[str]
    start_date: date
    end_date: date
    initial_capital: float = Field(gt=0, default=10000.0)
    timeframe: str = Field(default="1d")  # 1m, 5m, 15m, 1h, 1d
    commission: float = Field(ge=0, default=0.0)
    slippage: float = Field(ge=0, default=0.001)

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, v):
        """Validate symbols list is not empty."""
        if not v or len(v) == 0:
            raise ValueError("At least one symbol required")
        return v

    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, v, info):
        """Validate end_date is after start_date."""
        if "start_date" in info.data and v <= info.data["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v

    @field_validator("timeframe")
    @classmethod
    def validate_timeframe(cls, v):
        """Validate timeframe is supported."""
        valid_timeframes = ["1m", "5m", "15m", "1h", "1d"]
        if v not in valid_timeframes:
            raise ValueError(f"Invalid timeframe: {v}. Must be one of {valid_timeframes}")
        return v


class TradeResponse(BaseModel):
    """Response schema for trade."""

    id: int
    symbol: str
    side: str
    entry_date: date
    entry_price: float
    quantity: float
    exit_date: Optional[date] = None
    exit_price: Optional[float] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    commission: float
    status: str

    model_config = {"from_attributes": True}


class BacktestResultResponse(BaseModel):
    """Response schema for backtest results."""

    total_return: float
    total_return_pct: float
    sharpe_ratio: Optional[float] = None
    max_drawdown: float
    max_drawdown_pct: float
    win_rate: float
    profit_factor: Optional[float] = None
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_win: Optional[float] = None
    avg_loss: Optional[float] = None
    avg_trade_duration: Optional[float] = None
    final_capital: float
    equity_curve: Dict[str, Any]

    model_config = {"from_attributes": True}


class BacktestResponse(BaseModel):
    """Response schema for backtest."""

    id: int
    strategy_id: int
    name: str
    symbols: List[str]
    start_date: date
    end_date: date
    initial_capital: float
    timeframe: str
    commission: float
    slippage: float
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    results: Optional[BacktestResultResponse] = None

    model_config = {"from_attributes": True}


class BacktestListResponse(BaseModel):
    """Response for listing backtests."""

    backtests: List[BacktestResponse]
    total: int


class BacktestTradesResponse(BaseModel):
    """Response for backtest trades."""

    trades: List[TradeResponse]
    total: int


class SignalResponse(BaseModel):
    """Response schema for signal."""

    id: int
    symbol: str
    signal_type: str
    timestamp: datetime
    price: float
    strength: Optional[float] = None
    indicators: Optional[Dict[str, Any]] = None
    metadata_: Optional[Dict[str, Any]] = Field(None, alias="metadata")

    model_config = {"from_attributes": True}


class BacktestSignalsResponse(BaseModel):
    """Response for backtest signals."""

    signals: List[SignalResponse]
    total: int
