"""
Market data service for caching and retrieving OHLCV data.
"""

from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import logging

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData
from app.services.alpaca_service import get_alpaca_service

logger = logging.getLogger(__name__)


class MarketDataService:
    """Service for managing market data."""

    def __init__(self, market_db: AsyncSession):
        """Initialize service."""
        self.db = market_db
        self.alpaca_service = get_alpaca_service()

    async def get_bars(
        self,
        symbols: List[str],
        start: date | None,
        end: date | None,
        timeframe: str = "1d",
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get OHLCV bars for symbols, fetching and caching stale data as needed.

        Args:
            symbols: List of ticker symbols
            start: Start date
            end: End date
            timeframe: Timeframe string

        Returns:
            Dictionary mapping symbols to list of bars
        """
        result = {}

        for symbol in symbols:
            # Check if we have stale data and need to refresh
            await self._refresh_stale_data(symbol, timeframe)

            # Fetch from database
            db_bars = await self._get_db_bars(symbol, start, end, timeframe)
            result[symbol] = db_bars if db_bars else []

        return result

    async def _refresh_stale_data(self, symbol: str, timeframe: str) -> None:
        """
        Refresh stale data for a symbol/timeframe.

        Args:
            symbol: Ticker symbol
            timeframe: Timeframe string
        """
        latest_date = await self._get_latest_date(symbol, timeframe)
        cutoff_date = date.today() - timedelta(days=1)

        if latest_date is None or latest_date < cutoff_date:
            fetch_start = latest_date + timedelta(days=1) if latest_date else date.today() - timedelta(days=365)
            fetch_end = cutoff_date

            logger.info(f"Refreshing stale data for {symbol} from {fetch_start} to {fetch_end}")
            alpaca_data = await self.alpaca_service.get_bars([symbol], fetch_start, fetch_end, timeframe)

            if symbol in alpaca_data and alpaca_data[symbol]:
                bars = alpaca_data[symbol]
                await self._cache_bars(symbol, timeframe, bars)

    async def _get_latest_date(self, symbol: str, timeframe: str) -> Optional[date]:
        """
        Get the latest trade date for a symbol/timeframe in the database.

        Args:
            symbol: Ticker symbol
            timeframe: Timeframe string

        Returns:
            Latest trade date or None if no data exists
        """
        try:
            query = select(func.max(MarketData.trade_date)).where(
                and_(
                    MarketData.symbol == symbol,
                    MarketData.timeframe == timeframe,
                )
            )
            result = await self.db.execute(query)
            return result.scalar()
        except Exception as e:
            logger.error(f"Error getting latest date for {symbol}/{timeframe}: {e}")
            return None

    async def _get_db_bars(
        self, symbol: str, start: date | None, end: date | None, timeframe: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached bars from database.

        Args:
            symbol: Ticker symbol
            start: Start date
            end: End date
            timeframe: Timeframe string

        Returns:
            List of bars or None if not fully cached
        """
        predicate = (
            MarketData.symbol == symbol,
            MarketData.timeframe == timeframe,
        )

        if start and end:
            predicate += (MarketData.trade_date >= start, MarketData.trade_date <= end)

        try:
            query = select(MarketData).where(and_(*predicate)).order_by(MarketData.trade_date)

            result = await self.db.execute(query)
            bars = result.scalars().all()

            if not bars:
                return None

            return [
                {
                    "timestamp": bar.trade_date,
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

    async def _cache_bars(self, symbol: str, timeframe: str, bars: List[Dict[str, Any]]) -> None:
        """
        Cache bars in database.

        Args:
            symbol: Ticker symbol
            timeframe: Timeframe string
            bars: List of bar data
        """
        try:
            for bar in bars:
                trade_date = bar["timestamp"]
                # Check if bar already exists
                query = select(MarketData).where(
                    and_(
                        MarketData.symbol == symbol,
                        MarketData.timeframe == timeframe,
                        MarketData.trade_date == trade_date,
                    )
                )
                result = await self.db.execute(query)
                existing_bar = result.scalar_one_or_none()

                if not existing_bar:
                    # Create new bar
                    market_data = MarketData(
                        symbol=symbol,
                        timeframe=timeframe,
                        trade_date=trade_date,
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
