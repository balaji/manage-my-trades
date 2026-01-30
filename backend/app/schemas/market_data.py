"""
Market data schemas.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class OHLCVBar(BaseModel):
    """OHLCV bar data."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: Optional[float] = None
    trade_count: Optional[int] = None


class MarketDataRequest(BaseModel):
    """Request for market data."""

    symbols: List[str] = Field(..., description="List of ticker symbols")
    start_date: datetime = Field(..., description="Start date")
    end_date: datetime = Field(..., description="End date")
    timeframe: str = Field(default="1d", description="Timeframe (1m, 5m, 15m, 1h, 1d)")


class MarketDataResponse(BaseModel):
    """Response with market data."""

    symbol: str
    timeframe: str
    bars: List[OHLCVBar]


class SymbolInfo(BaseModel):
    """Symbol information."""

    symbol: str
    name: str


class SymbolSearchResponse(BaseModel):
    """Response for symbol search."""

    symbols: List[SymbolInfo]


class LatestQuote(BaseModel):
    """Latest quote data."""

    symbol: str
    ask_price: float
    bid_price: float
    ask_size: float
    bid_size: float
    timestamp: datetime


class MarketDataCache(BaseModel):
    """Cached market data."""

    id: int
    symbol: str
    timeframe: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: Optional[float] = None
    trade_count: Optional[int] = None

    class Config:
        from_attributes = True
