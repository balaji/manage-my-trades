"""Technical analysis schemas."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IndicatorRequest(BaseModel):
    """Request for indicator calculation."""

    symbol: str = Field(..., description="Ticker symbol")
    timeframe: str = Field(default="1d", description="Timeframe (1m, 5m, 15m, 1h, 1d)")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    indicators: list[dict[str, Any]] = Field(
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
    params: dict[str, Any]
    outputs: dict[str, list[IndicatorValue]]


class IndicatorResponse(BaseModel):
    """Response with calculated indicators."""

    symbol: str
    timeframe: str
    indicators: list[IndicatorResult]


class IndicatorConfig(BaseModel):
    """Configuration for an indicator."""

    name: str = Field(..., description="Indicator name (sma, ema, rsi, macd, etc.)")
    params: dict[str, Any] = Field(default_factory=dict, description="Indicator parameters")


class SupportedIndicatorsResponse(BaseModel):
    """List of supported indicators."""

    indicators: list[dict[str, Any]]


class RegimeRequest(BaseModel):
    """Request for HMM regime detection."""

    symbol: str = Field(..., description="Ticker symbol")
    timeframe: str = Field(default="1d", description="Timeframe (1d, 1h, etc.)")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    n_regimes: int = Field(default=3, ge=2, le=4, description="Number of regimes to detect")
    regime_type: Literal["directional", "volatility", "combined"] = Field(
        default="directional", description="Regime label assignment strategy"
    )


class RegimeSegment(BaseModel):
    """A contiguous time segment with a single regime label."""

    start: datetime
    end: datetime
    regime: str


class RegimeResponse(BaseModel):
    """Response with detected regime segments."""

    symbol: str
    timeframe: str
    segments: list[RegimeSegment]
