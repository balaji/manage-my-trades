"""
Signal service for generating and managing trading signals.
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signal import Signal
from app.models.strategy import Strategy
from app.services.market_data_service import MarketDataService
from app.services.technical_analysis_service import TechnicalAnalysisService

logger = logging.getLogger(__name__)


class SignalService:
    """Service for generating and managing trading signals."""

    def __init__(self, db: AsyncSession, market_db: AsyncSession):
        """Initialize signal service."""
        self.db = db
        self.technical_analysis_service = TechnicalAnalysisService(market_db)
        self.market_data_service = MarketDataService(market_db)

    async def generate_signals(
        self,
        strategy: Strategy,
        symbol: str,
        start_date: date,
        end_date: date,
    ) -> List[Signal]:
        """
        Generate trading signals for a strategy on a symbol.

        Args:
            strategy: Trading strategy
            symbol: Stock/ETF symbol
            start_date: Start date for signal generation
            end_date: End date for signal generation

        Returns:
            List of generated signals
        """
        logger.info(f"Generating signals for strategy {strategy.id} on {symbol}")

        # Get market data
        bars = await self.market_data_service.get_bars(
            symbols=[symbol],
            start=start_date,
            end=end_date,
        )

        if not bars or symbol not in bars:
            logger.warning(f"No market data found for {symbol}")
            return []

        bar_data = bars[symbol]
        if not bar_data:
            return []

        # Calculate all indicators for the strategy
        indicator_values = self._calculate_strategy_indicators(strategy, symbol, bars)

        # Generate signals based on strategy configuration
        signals = []
        for i, bar in enumerate(bar_data):
            # Get indicator values at this point
            current_indicators = {
                name: values[i]["value"] if i < len(values) else None for name, values in indicator_values.items()
            }

            # Evaluate entry/exit conditions
            signal_type, strength, metadata = self._evaluate_conditions(strategy, current_indicators, bar)

            if signal_type and signal_type != "hold":
                signal = Signal(
                    strategy_id=strategy.id,
                    symbol=symbol,
                    signal_type=signal_type,
                    timestamp=bar["timestamp"],
                    price=bar["close"],
                    strength=strength,
                    indicators=current_indicators,
                    metadata_=metadata,
                )
                signals.append(signal)
                self.db.add(signal)

        if signals:
            await self.db.commit()
            logger.info(f"Generated {len(signals)} signals for {symbol}")

        return signals

    async def get_strategy_signals(
        self,
        strategy_id: int,
        symbol: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        signal_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[Signal], int]:
        """
        Get signals for a strategy with optional filtering.

        Args:
            strategy_id: Strategy ID
            symbol: Filter by symbol
            start_date: Filter by start date
            end_date: Filter by end date
            signal_type: Filter by signal type (buy, sell, hold)
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (list of signals, total count)
        """
        # Build query
        query = select(Signal).where(Signal.strategy_id == strategy_id)

        # Apply filters
        if symbol:
            query = query.where(Signal.symbol == symbol)
        if start_date:
            query = query.where(Signal.timestamp >= start_date)
        if end_date:
            query = query.where(Signal.timestamp <= end_date)
        if signal_type:
            query = query.where(Signal.signal_type == signal_type)

        # Get total count
        count_result = await self.db.execute(query)
        total = len(count_result.scalars().all())

        # Apply pagination and ordering
        query = query.order_by(Signal.timestamp.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        signals = result.scalars().all()

        return list(signals), total

    def _calculate_strategy_indicators(self, strategy: Strategy, symbol: str, bars) -> Dict[str, List[float]]:
        """
        Calculate all indicators for a strategy.

        Args:
            strategy: Trading strategy
            symbol: Stock/ETF symbol
            start_date: Start date
            end_date: End date

        Returns:
            Dictionary mapping indicator names to their values
        """
        indicator_values = {}

        for indicator_config in strategy.indicators:
            try:
                result = self.technical_analysis_service.calculate_indicators_with_bars(
                    symbol=symbol,
                    bars_data=bars,
                    timeframe="1d",
                    indicators=[{"name": indicator_config.indicator_name, "params": indicator_config.parameters}],
                )

                indicators = result.get("indicators", {})
                if indicator_config.indicator_name in indicators:
                    indicator_values[indicator_config.indicator_name] = indicators[indicator_config.indicator_name][
                        "values"
                    ]
            except Exception as e:
                logger.error(f"Failed to calculate {indicator_config.indicator_name}: {e}")

        return indicator_values

    def _evaluate_conditions(
        self,
        strategy: Strategy,
        indicators: Dict[str, Optional[float]],
        bar: Dict[str, Any],
    ) -> tuple[Optional[str], Optional[float], Dict[str, Any]]:
        """
        Evaluate strategy conditions to generate a signal.

        Args:
            strategy: Trading strategy
            indicators: Current indicator values
            bar: Current price bar

        Returns:
            Tuple of (signal_type, strength, metadata)
        """
        config = strategy.config
        signal_type = None
        strength = 0.5
        metadata = {}

        # Technical strategy evaluation
        if strategy.strategy_type == "technical":
            signal_type, strength, metadata = self._evaluate_technical_strategy(config, indicators, bar)

        # ML strategy would be evaluated differently
        elif strategy.strategy_type == "ml":
            # Placeholder for ML strategy evaluation
            pass

        # Combined strategy
        elif strategy.strategy_type == "combined":
            # Placeholder for combined strategy evaluation
            pass

        return signal_type, strength, metadata

    def _evaluate_technical_strategy(
        self,
        config: Dict[str, Any],
        indicators: Dict[str, Optional[float]],
        bar: Dict[str, Any],
    ) -> tuple[Optional[str], float, Dict[str, Any]]:
        """
        Evaluate technical strategy conditions.

        Args:
            config: Strategy configuration
            indicators: Current indicator values
            bar: Current price bar

        Returns:
            Tuple of (signal_type, strength, metadata)
        """
        signal_type = None
        strength = 0.5
        metadata = {}

        # RSI-based strategies
        if "rsi" in indicators and indicators["rsi"] is not None:
            rsi = indicators["rsi"]
            entry_threshold = config.get("entry_threshold", 30)
            exit_threshold = config.get("exit_threshold", 70)

            if rsi < entry_threshold:
                signal_type = "buy"
                strength = min((entry_threshold - rsi) / entry_threshold, 1.0)
                metadata["reason"] = f"RSI ({rsi:.2f}) below entry threshold ({entry_threshold})"
            elif rsi > exit_threshold:
                signal_type = "sell"
                strength = min((rsi - exit_threshold) / (100 - exit_threshold), 1.0)
                metadata["reason"] = f"RSI ({rsi:.2f}) above exit threshold ({exit_threshold})"

        # MACD-based strategies
        elif "macd" in indicators and indicators["macd"] is not None:
            macd_data = indicators["macd"]
            # MACD returns dict with macd, signal, histogram
            if isinstance(macd_data, dict):
                histogram = macd_data.get("histogram", 0)
                if histogram > 0:
                    signal_type = "buy"
                    strength = min(abs(histogram) / 10, 1.0)
                    metadata["reason"] = "MACD histogram positive (bullish crossover)"
                elif histogram < 0:
                    signal_type = "sell"
                    strength = min(abs(histogram) / 10, 1.0)
                    metadata["reason"] = "MACD histogram negative (bearish crossover)"

        # SMA/EMA crossover strategies
        elif "sma" in indicators and "ema" in indicators:
            sma = indicators.get("sma")
            ema = indicators.get("ema")
            if sma and ema:
                if ema > sma:
                    signal_type = "buy"
                    strength = min(abs(ema - sma) / sma, 1.0)
                    metadata["reason"] = "EMA above SMA (golden cross)"
                elif ema < sma:
                    signal_type = "sell"
                    strength = min(abs(sma - ema) / sma, 1.0)
                    metadata["reason"] = "EMA below SMA (death cross)"

        return signal_type, strength, metadata

    async def delete_strategy_signals(self, strategy_id: int) -> int:
        """
        Delete all signals for a strategy.

        Args:
            strategy_id: Strategy ID

        Returns:
            Number of signals deleted
        """
        result = await self.db.execute(select(Signal).where(Signal.strategy_id == strategy_id))
        signals = result.scalars().all()
        count = len(signals)

        for signal in signals:
            await self.db.delete(signal)

        await self.db.commit()
        logger.info(f"Deleted {count} signals for strategy {strategy_id}")
        return count
