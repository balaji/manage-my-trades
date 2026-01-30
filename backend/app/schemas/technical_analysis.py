"""
Technical analysis schemas.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class IndicatorRequest(BaseModel):
    """Request for indicator calculation."""

    symbol: str = Field(..., description="Ticker symbol")
    timeframe: str = Field(default="1d", description="Timeframe (1m, 5m, 15m, 1h, 1d)")
    start_date: datetime = Field(..., description="Start date")
    end_date: datetime = Field(..., description="End date")
    indicators: List[Dict[str, Any]] = Field(
        ...,
        description="List of indicators to calculate. Each should have 'name' and optional 'params'",
    )


class IndicatorValue(BaseModel):
    """Single indicator value at a timestamp."""

    timestamp: datetime
    value: float


class IndicatorResult(BaseModel):
    """Result for a single indicator."""

    name: str
    params: Dict[str, Any]
    values: List[IndicatorValue]


class IndicatorResponse(BaseModel):
    """Response with calculated indicators."""

    symbol: str
    timeframe: str
    indicators: List[IndicatorResult]


class IndicatorConfig(BaseModel):
    """Configuration for an indicator."""

    name: str = Field(..., description="Indicator name (sma, ema, rsi, macd, etc.)")
    params: Dict[str, Any] = Field(default_factory=dict, description="Indicator parameters (e.g., {'length': 20})")


class SupportedIndicatorsResponse(BaseModel):
    """List of supported indicators."""

    indicators: List[Dict[str, Any]]
