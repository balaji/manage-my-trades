"""
Technical analysis service for calculating indicators.
"""

import json
from datetime import date, datetime
from typing import List, Dict, Any
import logging
import pandas as pd

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis_client import regime_cache_key, seconds_until_midnight_utc
from app.services.market_data_service import MarketDataService
from app.core.indicators.calculator import IndicatorCalculator, get_supported_indicators
from app.core.regime_detector import RegimeDetector

logger = logging.getLogger(__name__)


def _json_default(obj: Any) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class TechnicalAnalysisService:
    """Service for technical analysis and indicator calculation."""

    def __init__(self, market_db: AsyncSession, redis_client: Redis | None = None):
        """Initialize service."""
        self.market_data_service = MarketDataService(market_db)
        self.redis = redis_client

    async def calculate_indicators(
        self,
        symbol: str,
        timeframe: str,
        start: date,
        end: date,
        indicators: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Calculate technical indicators for a symbol.

        Args:
            symbol: Ticker symbol
            timeframe: Timeframe string
            start: Start datetime
            end: End datetime
            indicators: List of indicator configurations

        Returns:
            Dictionary with calculated indicators
        """
        try:
            # Get market data
            bars_data = await self.market_data_service.get_bars(
                symbols=[symbol],
                start=start,
                end=end,
                timeframe=timeframe,
            )

            return self.calculate_indicators_with_bars(bars_data[symbol], symbol, timeframe, indicators)

        except Exception as e:
            logger.error(f"Error calculating indicators: {e}")
            raise

    def calculate_indicators_with_bars(
        self,
        bars_data: List[Dict[str, Any]],
        symbol: str,
        timeframe: str,
        indicators: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        try:
            if not bars_data:
                raise ValueError(f"No market data found for {symbol}")

            # Convert to DataFrame
            df = pd.DataFrame(bars_data)

            # Calculate indicators
            calculator = IndicatorCalculator(df)
            results = calculator.calculate_multiple(indicators)

            logger.info(f"Calculated {len(results)} indicators for {symbol}")

            return {"symbol": symbol, "timeframe": timeframe, "indicators": results}

        except Exception as e:
            logger.error(f"Error calculating indicators: {e}")
            raise

    async def _compute_regimes(
        self,
        symbol: str,
        timeframe: str,
        n_regimes: int,
        regime_type: str,
    ) -> Dict[str, Any]:
        bars_data = await self.market_data_service.get_bars(
            symbols=[symbol],
            start=None,
            end=None,
            timeframe=timeframe,
        )

        symbol_bars = bars_data.get(symbol, [])
        if not symbol_bars:
            raise ValueError(f"No market data found for {symbol}")

        df = pd.DataFrame(symbol_bars)
        detector = RegimeDetector(n_regimes=n_regimes, regime_type=regime_type)
        segments = detector.detect(df)

        return {"symbol": symbol, "timeframe": timeframe, "segments": segments}

    async def detect_regimes(
        self,
        symbol: str,
        timeframe: str,
        n_regimes: int = 3,
        regime_type: str = "directional",
    ) -> Dict[str, Any]:
        key: str | None = None
        if self.redis is not None:
            key = regime_cache_key(symbol, timeframe, n_regimes, regime_type)
            try:
                cached = await self.redis.get(key)
                if cached:
                    logger.debug("Regime cache hit for %s", key)
                    return json.loads(cached)
            except Exception as e:
                logger.warning("Redis read failed, computing directly: %s", e)

        result = await self._compute_regimes(symbol, timeframe, n_regimes, regime_type)

        if self.redis is not None and key is not None:
            try:
                ttl = seconds_until_midnight_utc()
                await self.redis.setex(key, ttl, json.dumps(result, default=_json_default))
                logger.debug("Regime result cached with TTL=%ds for %s", ttl, key)
            except Exception as e:
                logger.warning("Redis write failed, result not cached: %s", e)

        return result

    def get_supported_indicators(self) -> List[Dict[str, Any]]:
        """
        Get list of supported indicators.

        Returns:
            List of indicator information
        """
        return get_supported_indicators()
