"""
Alpaca API service for market data and trading.
"""

from datetime import date
from typing import List, Optional, Dict, Any
import logging

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestQuoteRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

from app.config import get_settings
from app.services.alpaca_service_base import AlpacaServiceBase
from app.services.alpaca_service_http import AlpacaServiceHttp

logger = logging.getLogger(__name__)
settings = get_settings()


class AlpacaService(AlpacaServiceBase):
    """Service for interacting with Alpaca API."""

    def __init__(self):
        """Initialize Alpaca clients."""
        self.data_client = StockHistoricalDataClient(
            api_key=settings.ALPACA_API_KEY, secret_key=settings.ALPACA_SECRET_KEY
        )

    def _convert_timeframe(self, timeframe: str) -> TimeFrame:
        """
        Convert timeframe string to Alpaca TimeFrame object.

        Args:
            timeframe: Timeframe string (1m, 5m, 15m, 1h, 1d)

        Returns:
            TimeFrame object
        """
        timeframe_map = {
            "1m": TimeFrame(1, TimeFrameUnit.Minute),
            "5m": TimeFrame(5, TimeFrameUnit.Minute),
            "15m": TimeFrame(15, TimeFrameUnit.Minute),
            "30m": TimeFrame(30, TimeFrameUnit.Minute),
            "1h": TimeFrame(1, TimeFrameUnit.Hour),
            "1d": TimeFrame(1, TimeFrameUnit.Day),
        }

        if timeframe not in timeframe_map:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        return timeframe_map[timeframe]

    async def get_bars(
        self, symbols: List[str], start: date, end: date, timeframe: str = "1d"
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch OHLCV bar data for symbols.

        Args:
            symbols: List of ticker symbols
            start: Start datetime
            end: End datetime
            timeframe: Timeframe string (default: 1d)

        Returns:
            Dictionary mapping symbols to list of bar data
        """
        try:
            accumulated: Dict[str, list] = {}
            next_page_token = None
            page_count = 0

            while True:
                request = StockBarsRequest(
                    symbol_or_symbols=symbols,
                    timeframe=self._convert_timeframe(timeframe),
                    start=start,
                    end=end,
                    page_token=next_page_token,
                )
                response = self.data_client.get_stock_bars(request)
                page_count += 1

                for symbol, bars in response.data.items():
                    accumulated.setdefault(symbol, []).extend(bars)

                next_page_token = response.next_page_token
                if not next_page_token:
                    break

                logger.info(f"Fetching page {page_count + 1} for {len(symbols)} symbols")

            result = {}
            for symbol in symbols:
                if symbol in accumulated:
                    bars = accumulated[symbol]
                    result[symbol] = [
                        {
                            "timestamp": bar.timestamp.date(),
                            "open": float(bar.open),
                            "high": float(bar.high),
                            "low": float(bar.low),
                            "close": float(bar.close),
                            "volume": float(bar.volume),
                            "vwap": float(bar.vwap) if bar.vwap else None,
                            "trade_count": bar.trade_count,
                        }
                        for bar in bars
                    ]
                else:
                    result[symbol] = []

            total_bars = sum(len(v) for v in result.values())
            logger.info(
                f"Fetched {total_bars} bars for {len(symbols)} symbols from {start} to {end} ({page_count} page(s))"
            )
            return result

        except Exception as e:
            logger.error(f"Error fetching bars: {e}")
            raise

    async def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get latest quote for a symbol.

        Args:
            symbol: Ticker symbol

        Returns:
            Latest quote data or None
        """
        try:
            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quotes = self.data_client.get_stock_latest_quote(request)

            if symbol in quotes:
                quote = quotes[symbol]
                return {
                    "symbol": symbol,
                    "ask_price": float(quote.ask_price),
                    "bid_price": float(quote.bid_price),
                    "ask_size": float(quote.ask_size),
                    "bid_size": float(quote.bid_size),
                    "timestamp": quote.timestamp,
                }

            return None

        except Exception as e:
            logger.error(f"Error fetching latest quote for {symbol}: {e}")
            return None

    async def search_symbols(self, query: str) -> List[Dict[str, str]]:
        """
        Search for symbols (simplified - returns common ETFs).

        Args:
            query: Search query

        Returns:
            List of symbol information
        """
        # For now, return a curated list of popular ETFs
        # In production, you could use a separate API or database
        popular_etfs = [
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust"},
            {"symbol": "QQQ", "name": "Invesco QQQ Trust"},
            {"symbol": "IWM", "name": "iShares Russell 2000 ETF"},
            {"symbol": "DIA", "name": "SPDR Dow Jones Industrial Average ETF"},
            {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF"},
            {"symbol": "VOO", "name": "Vanguard S&P 500 ETF"},
            {"symbol": "VEA", "name": "Vanguard FTSE Developed Markets ETF"},
            {"symbol": "VWO", "name": "Vanguard FTSE Emerging Markets ETF"},
            {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF"},
            {"symbol": "BND", "name": "Vanguard Total Bond Market ETF"},
            {"symbol": "GLD", "name": "SPDR Gold Trust"},
            {"symbol": "SLV", "name": "iShares Silver Trust"},
            {"symbol": "XLF", "name": "Financial Select Sector SPDR Fund"},
            {"symbol": "XLK", "name": "Technology Select Sector SPDR Fund"},
            {"symbol": "XLE", "name": "Energy Select Sector SPDR Fund"},
        ]

        query_lower = query.lower()
        return [
            etf for etf in popular_etfs if query_lower in etf["symbol"].lower() or query_lower in etf["name"].lower()
        ]


# Singleton instance
_alpaca_service: Optional[AlpacaServiceBase] = None


def get_alpaca_service(key_id: Optional[str] = None, secret_key: Optional[str] = None) -> AlpacaServiceBase:
    """Get or create Alpaca service instance."""
    if key_id and secret_key:
        return AlpacaServiceHttp(key_id=key_id, secret_key=secret_key)

    global _alpaca_service
    if _alpaca_service is None:
        _alpaca_service = AlpacaServiceHttp()
    return _alpaca_service
