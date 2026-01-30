"""
Technical analysis service for calculating indicators.
"""

from datetime import datetime
from typing import List, Dict, Any
import logging
import pandas as pd

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.market_data_service import MarketDataService
from app.core.indicators.calculator import IndicatorCalculator, get_supported_indicators

logger = logging.getLogger(__name__)


class TechnicalAnalysisService:
    """Service for technical analysis and indicator calculation."""

    def __init__(self, db: AsyncSession):
        """Initialize service."""
        self.db = db
        self.market_data_service = MarketDataService(db)

    async def calculate_indicators(
        self,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
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
                use_cache=True,
            )

            if symbol not in bars_data or not bars_data[symbol]:
                raise ValueError(f"No market data found for {symbol}")

            bars = bars_data[symbol]

            # Convert to DataFrame
            df = pd.DataFrame(bars)

            # Calculate indicators
            calculator = IndicatorCalculator(df)
            results = calculator.calculate_multiple(indicators)

            logger.info(f"Calculated {len(results)} indicators for {symbol}")

            return {"symbol": symbol, "timeframe": timeframe, "indicators": results}

        except Exception as e:
            logger.error(f"Error calculating indicators: {e}")
            raise

    def get_supported_indicators(self) -> List[Dict[str, Any]]:
        """
        Get list of supported indicators.

        Returns:
            List of indicator information
        """
        return get_supported_indicators()
