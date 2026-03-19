"""
Strategy schemas for API requests and responses.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class StrategyType(str, Enum):
    """Strategy type enumeration."""

    TECHNICAL = "technical"
    ML = "ml"
    COMBINED = "combined"


class SignalType(str, Enum):
    """Signal type enumeration."""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class IndicatorUsage(str, Enum):
    """Indicator usage enumeration."""

    ENTRY = "entry"
    EXIT = "exit"
    FILTER = "filter"


class StrategyIndicatorConfig(BaseModel):
    """Indicator configuration for a strategy."""

    indicator_name: str = Field(..., description="Name of the indicator (sma, ema, rsi, macd, etc.)")
    parameters: dict = Field(default_factory=dict, description="Indicator-specific parameters (e.g., {'period': 20})")
    usage: IndicatorUsage = Field(..., description="How the indicator is used (entry, exit, filter)")

    @field_validator("indicator_name")
    @classmethod
    def validate_indicator_name(cls, v: str) -> str:
        """Validate indicator name."""
        valid_indicators = ["sma", "ema", "rsi", "macd", "bollinger_bands", "stochastic", "atr"]
        if v.lower() not in valid_indicators:
            raise ValueError(f"Invalid indicator name. Must be one of: {', '.join(valid_indicators)}")
        return v.lower()

    class Config:
        json_schema_extra = {"example": {"indicator_name": "rsi", "parameters": {"period": 14}, "usage": "entry"}}


class StrategyCreate(BaseModel):
    """Schema for creating a new strategy."""

    name: str = Field(..., min_length=1, max_length=255, description="Unique strategy name")
    description: Optional[str] = Field(None, description="Strategy description")
    strategy_type: StrategyType = Field(..., description="Type of strategy")
    config: dict = Field(default_factory=dict, description="Strategy-specific configuration")
    indicators: List[StrategyIndicatorConfig] = Field(default_factory=list, description="List of indicators to use")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate strategy name."""
        if not v or v.strip() == "":
            raise ValueError("Strategy name cannot be empty")
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "name": "RSI Mean Reversion",
                "description": "Buy when RSI < 30, sell when RSI > 70",
                "strategy_type": "technical",
                "config": {
                    "symbols": ["SPY", "QQQ"],
                    "entry_threshold": 30,
                    "exit_threshold": 70,
                    "position_size": 0.1,
                },
                "indicators": [{"indicator_name": "rsi", "parameters": {"period": 14}, "usage": "entry"}],
            }
        }


class StrategyUpdate(BaseModel):
    """Schema for updating an existing strategy."""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Strategy name")
    description: Optional[str] = Field(None, description="Strategy description")
    strategy_type: Optional[StrategyType] = Field(None, description="Type of strategy")
    is_active: Optional[bool] = Field(None, description="Whether the strategy is active")
    config: Optional[dict] = Field(None, description="Strategy-specific configuration")
    indicators: Optional[List[StrategyIndicatorConfig]] = Field(None, description="List of indicators to use")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated RSI Strategy",
                "is_active": True,
                "config": {"entry_threshold": 35, "exit_threshold": 65},
            }
        }


class StrategyIndicatorResponse(BaseModel):
    """Response schema for strategy indicator."""

    id: int
    strategy_id: int
    indicator_name: str
    parameters: dict
    usage: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StrategyResponse(BaseModel):
    """Response schema for strategy."""

    id: int
    name: str
    description: Optional[str]
    strategy_type: str
    is_active: bool
    config: dict
    indicators: List[StrategyIndicatorResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "RSI Mean Reversion",
                "description": "Buy when RSI < 30, sell when RSI > 70",
                "strategy_type": "technical",
                "is_active": True,
                "config": {"symbols": ["SPY", "QQQ"], "entry_threshold": 30, "exit_threshold": 70},
                "indicators": [
                    {
                        "id": 1,
                        "strategy_id": 1,
                        "indicator_name": "rsi",
                        "parameters": {"period": 14},
                        "usage": "entry",
                        "created_at": "2024-01-15T10:00:00",
                        "updated_at": "2024-01-15T10:00:00",
                    }
                ],
                "created_at": "2024-01-15T10:00:00",
                "updated_at": "2024-01-15T10:00:00",
            }
        }


class StrategyListResponse(BaseModel):
    """Response schema for listing strategies."""

    strategies: List[StrategyResponse]
    total: int

    class Config:
        json_schema_extra = {"example": {"strategies": [], "total": 0}}


class SignalResponse(BaseModel):
    """Response schema for trading signal."""

    id: int
    backtest_result_id: int
    symbol: str
    signal_type: str
    timestamp: date
    price: float
    strength: Optional[float]
    indicators: dict
    metadata_: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "backtest_result_id": 1,
                "symbol": "SPY",
                "signal_type": "buy",
                "timestamp": "2024-01-15T14:30:00",
                "price": 450.25,
                "strength": 0.85,
                "indicators": {"rsi": 28.5},
                "metadata_": {"reason": "RSI below entry threshold"},
                "created_at": "2024-01-15T14:30:05",
                "updated_at": "2024-01-15T14:30:05",
            }
        }


class SignalListResponse(BaseModel):
    """Response schema for listing signals."""

    signals: List[SignalResponse]
    total: int

    class Config:
        json_schema_extra = {"example": {"signals": [], "total": 0}}
