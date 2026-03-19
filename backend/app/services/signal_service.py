"""
Signal service for generating and managing trading signals.
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

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

        # Calculate all indicators for the strategy
        indicator_values = self._calculate_strategy_indicators(strategy, symbol, bar_data)

        # Build timestamp->value maps for each indicator (handles NaN stripping correctly)
        indicator_maps = {}
        for indicator_name, values_list in indicator_values.items():
            # Create timestamp->value map
            if isinstance(values_list, dict):
                # If it's already a dict (columns format), use as-is
                indicator_maps[indicator_name] = values_list
            else:
                # If it's a list of {timestamp, value} dicts, build a map
                indicator_maps[indicator_name] = {entry["timestamp"]: entry["value"] for entry in values_list}

        # Generate signals based on strategy configuration
        signals = []
        for bar in bar_data:
            # Get indicator values at this point using timestamp lookup
            current_indicators = {name: value_map.get(bar["timestamp"]) for name, value_map in indicator_maps.items()}

            # Evaluate entry/exit conditions
            signal_type, strength, metadata = self._evaluate_conditions(strategy, current_indicators, bar)

            if signal_type and signal_type != "hold":
                signal = Signal(
                    symbol=symbol,
                    signal_type=signal_type,
                    timestamp=bar["timestamp"],
                    price=bar["close"],
                    strength=strength,
                    indicators=current_indicators,
                    metadata_=metadata,
                )
                signals.append(signal)

        logger.info(f"Generated {len(signals)} signals for {symbol}")
        return signals

    def _calculate_strategy_indicators(
        self, strategy: Strategy, symbol: str, bars_data: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Calculate all indicators for a strategy.

        Args:
            strategy: Trading strategy
            symbol: Stock/ETF symbol
            bars_data: Market data bars

        Returns:
            Dictionary mapping indicator names to their timestamp-indexed values
        """
        indicator_values = {}

        for indicator_config in strategy.indicators:
            try:
                result = self.technical_analysis_service.calculate_indicators_with_bars(
                    symbol=symbol,
                    bars_data=bars_data,
                    timeframe="1d",
                    indicators=[{"name": indicator_config.indicator_name, "params": indicator_config.parameters}],
                )

                indicators = result.get("indicators", {})

                # Find the key matching this indicator (format: "RSI_<hash>", "SMA_<hash>", etc.)
                prefix = indicator_config.indicator_name.upper() + "_"
                matching_key = next((k for k in indicators if k.startswith(prefix)), None)

                if matching_key:
                    data = indicators[matching_key]
                    # Extract values list or columns dict
                    if "values" in data:
                        indicator_values[indicator_config.indicator_name] = data["values"]
                    elif "columns" in data:
                        indicator_values[indicator_config.indicator_name] = data["columns"]
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
