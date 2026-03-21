"""
Abstract base class for Alpaca API service implementations.
"""

from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional, Dict, Any


class AlpacaServiceBase(ABC):
    """Abstract base class defining the Alpaca service interface."""

    @abstractmethod
    def _convert_timeframe(self, timeframe: str) -> Any:
        """Convert a timeframe string (e.g. '1d', '1h') to the implementation-specific format."""

    @abstractmethod
    async def get_bars(
        self, symbols: List[str], start: date, end: date, timeframe: str = "1d"
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch OHLCV bar data for one or more symbols."""

    @abstractmethod
    async def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get the latest bid/ask quote for a symbol."""

    @abstractmethod
    async def search_symbols(self, query: str) -> List[Dict[str, str]]:
        """Search for symbols matching a query string."""
