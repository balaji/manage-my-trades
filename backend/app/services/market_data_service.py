"""
Market data service for caching and retrieving OHLCV data.
"""
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData
from app.services.alpaca_service import get_alpaca_service

logger = logging.getLogger(__name__)


class MarketDataService:
    """Service for managing market data."""

    def __init__(self, db: AsyncSession):
        """Initialize service."""
        self.db = db
        self.alpaca_service = get_alpaca_service()

    async def get_bars(
        self,
        symbols: List[str],
        start: datetime,
        end: datetime,
        timeframe: str = "1d",
        use_cache: bool = True
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get OHLCV bars for symbols, using cache when possible.

        Args:
            symbols: List of ticker symbols
            start: Start datetime
            end: End datetime
            timeframe: Timeframe string
            use_cache: Whether to use cached data

        Returns:
            Dictionary mapping symbols to list of bars
        """
        result = {}

        for symbol in symbols:
            if use_cache:
                # Try to get from cache first
                cached_bars = await self._get_cached_bars(symbol, start, end, timeframe)
                if cached_bars:
                    result[symbol] = cached_bars
                    logger.info(f"Using cached data for {symbol}")
                    continue

            # Fetch from Alpaca and cache
            logger.info(f"Fetching fresh data for {symbol}")
            alpaca_data = await self.alpaca_service.get_bars([symbol], start, end, timeframe)

            if symbol in alpaca_data and alpaca_data[symbol]:
                bars = alpaca_data[symbol]
                result[symbol] = bars

                # Cache the data
                await self._cache_bars(symbol, timeframe, bars)
            else:
                result[symbol] = []

        return result

    async def _get_cached_bars(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        timeframe: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached bars from database.

        Args:
            symbol: Ticker symbol
            start: Start datetime
            end: End datetime
            timeframe: Timeframe string

        Returns:
            List of bars or None if not fully cached
        """
        try:
            query = select(MarketData).where(
                and_(
                    MarketData.symbol == symbol,
                    MarketData.timeframe == timeframe,
                    MarketData.timestamp >= start,
                    MarketData.timestamp <= end
                )
            ).order_by(MarketData.timestamp)

            result = await self.db.execute(query)
            bars = result.scalars().all()

            if not bars:
                return None

            return [
                {
                    "timestamp": bar.timestamp,
                    "open": bar.open,
                    "high": bar.high,
                    "low": bar.low,
                    "close": bar.close,
                    "volume": bar.volume,
                    "vwap": bar.vwap,
                    "trade_count": bar.trade_count,
                }
                for bar in bars
            ]

        except Exception as e:
            logger.error(f"Error retrieving cached bars: {e}")
            return None

    async def _cache_bars(
        self,
        symbol: str,
        timeframe: str,
        bars: List[Dict[str, Any]]
    ) -> None:
        """
        Cache bars in database.

        Args:
            symbol: Ticker symbol
            timeframe: Timeframe string
            bars: List of bar data
        """
        try:
            for bar in bars:
                # Check if bar already exists
                query = select(MarketData).where(
                    and_(
                        MarketData.symbol == symbol,
                        MarketData.timeframe == timeframe,
                        MarketData.timestamp == bar["timestamp"]
                    )
                )
                result = await self.db.execute(query)
                existing_bar = result.scalar_one_or_none()

                if not existing_bar:
                    # Create new bar
                    market_data = MarketData(
                        symbol=symbol,
                        timeframe=timeframe,
                        timestamp=bar["timestamp"],
                        open=bar["open"],
                        high=bar["high"],
                        low=bar["low"],
                        close=bar["close"],
                        volume=bar["volume"],
                        vwap=bar.get("vwap"),
                        trade_count=bar.get("trade_count"),
                    )
                    self.db.add(market_data)

            await self.db.commit()
            logger.info(f"Cached {len(bars)} bars for {symbol} ({timeframe})")

        except Exception as e:
            logger.error(f"Error caching bars: {e}")
            await self.db.rollback()

    async def search_symbols(self, query: str) -> List[Dict[str, str]]:
        """
        Search for symbols.

        Args:
            query: Search query

        Returns:
            List of symbol information
        """
        return await self.alpaca_service.search_symbols(query)

    async def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get latest quote for a symbol.

        Args:
            symbol: Ticker symbol

        Returns:
            Latest quote data
        """
        return await self.alpaca_service.get_latest_quote(symbol)
