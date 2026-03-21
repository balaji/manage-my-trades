"""
Signal service for generating and managing trading signals.
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.strategies.runtime import StrategyRuntime
from app.models.signal import Signal
from app.models.strategy import Strategy
from app.services.market_data_service import MarketDataService

logger = logging.getLogger(__name__)


class SignalService:
    """Service for generating and managing trading signals."""

    def __init__(self, db: AsyncSession, market_db: AsyncSession):
        """Initialize signal service."""
        self.db = db
        self.market_data_service = MarketDataService(market_db)

    async def generate_signals(
        self,
        strategy: Strategy,
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        bar_data: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Signal]:
        """
        Generate trading signals for a strategy on a symbol (in-memory only, no DB persistence).

        Args:
            strategy: Trading strategy
            symbol: Stock/ETF symbol
            start_date: Start date for signal generation (overridden if bar_data provided)
            end_date: End date for signal generation (overridden if bar_data provided)
            bar_data: Optional pre-fetched market data to use for signal generation

        Returns:
            List of generated signals (not persisted to DB)
        """
        logger.info(f"Generating signals for strategy {strategy.id} on {symbol}")

        # Fetch bar data if not provided
        if not bar_data:
            if not start_date or not end_date:
                logger.warning(f"No market data or date range provided for {symbol}")
                return []
            bars_dict = await self.market_data_service.get_bars([symbol], start_date, end_date)
            bar_data = bars_dict.get(symbol, [])
            if not bar_data:
                logger.warning(f"No market data found for {symbol}")
                return []

        runtime = StrategyRuntime(strategy.config)
        runtime_signals = runtime.generate_signals([{**bar, "symbol": symbol} for bar in bar_data])
        signals = [
            Signal(
                symbol=symbol,
                signal_type=item["signal_type"],
                timestamp=item["timestamp"],
                price=item["price"],
                strength=item["strength"],
                indicators=item["indicators"],
                metadata_=item["metadata"],
            )
            for item in runtime_signals
        ]

        logger.info(f"Generated {len(signals)} signals for {symbol}")
        return signals
