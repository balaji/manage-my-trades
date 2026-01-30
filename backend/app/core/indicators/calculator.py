"""
Core indicator calculation engine.
"""
from typing import List, Dict, Any, Optional
import pandas as pd
import pandas_ta as ta
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class IndicatorCalculator:
    """Calculator for technical indicators using pandas-ta."""

    def __init__(self, df: pd.DataFrame):
        """
        Initialize calculator with OHLCV data.

        Args:
            df: DataFrame with columns: timestamp, open, high, low, close, volume
        """
        self.df = df.copy()
        self.df.set_index('timestamp', inplace=True)
        self.df.sort_index(inplace=True)

    @staticmethod
    def create_hash(indicator_name: str, params: Dict[str, Any]) -> str:
        """
        Create hash for indicator with parameters.

        Args:
            indicator_name: Name of indicator
            params: Parameters dictionary

        Returns:
            Hash string
        """
        data = f"{indicator_name}:{json.dumps(params, sort_keys=True)}"
        return hashlib.sha256(data.encode()).hexdigest()

    def calculate(self, indicator_name: str, params: Optional[Dict[str, Any]] = None) -> pd.Series:
        """
        Calculate indicator.

        Args:
            indicator_name: Name of indicator (sma, ema, rsi, macd, etc.)
            params: Indicator parameters

        Returns:
            Series with indicator values

        Raises:
            ValueError: If indicator is not supported
        """
        if params is None:
            params = {}

        indicator_name = indicator_name.lower()

        try:
            if indicator_name == "sma":
                return self._calculate_sma(params)
            elif indicator_name == "ema":
                return self._calculate_ema(params)
            elif indicator_name == "rsi":
                return self._calculate_rsi(params)
            elif indicator_name == "macd":
                return self._calculate_macd(params)
            elif indicator_name == "stoch":
                return self._calculate_stochastic(params)
            elif indicator_name == "bbands":
                return self._calculate_bollinger_bands(params)
            elif indicator_name == "atr":
                return self._calculate_atr(params)
            else:
                raise ValueError(f"Unsupported indicator: {indicator_name}")

        except Exception as e:
            logger.error(f"Error calculating {indicator_name}: {e}")
            raise

    def _calculate_sma(self, params: Dict[str, Any]) -> pd.Series:
        """Calculate Simple Moving Average."""
        length = params.get("length", 20)
        return ta.sma(self.df['close'], length=length)

    def _calculate_ema(self, params: Dict[str, Any]) -> pd.Series:
        """Calculate Exponential Moving Average."""
        length = params.get("length", 20)
        return ta.ema(self.df['close'], length=length)

    def _calculate_rsi(self, params: Dict[str, Any]) -> pd.Series:
        """Calculate Relative Strength Index."""
        length = params.get("length", 14)
        return ta.rsi(self.df['close'], length=length)

    def _calculate_macd(self, params: Dict[str, Any]) -> pd.DataFrame:
        """Calculate MACD (returns DataFrame with MACD, signal, histogram)."""
        fast = params.get("fast", 12)
        slow = params.get("slow", 26)
        signal = params.get("signal", 9)
        return ta.macd(self.df['close'], fast=fast, slow=slow, signal=signal)

    def _calculate_stochastic(self, params: Dict[str, Any]) -> pd.DataFrame:
        """Calculate Stochastic Oscillator."""
        k = params.get("k", 14)
        d = params.get("d", 3)
        smooth_k = params.get("smooth_k", 3)
        return ta.stoch(
            self.df['high'],
            self.df['low'],
            self.df['close'],
            k=k,
            d=d,
            smooth_k=smooth_k
        )

    def _calculate_bollinger_bands(self, params: Dict[str, Any]) -> pd.DataFrame:
        """Calculate Bollinger Bands (returns DataFrame with upper, middle, lower)."""
        length = params.get("length", 20)
        std = params.get("std", 2.0)
        return ta.bbands(self.df['close'], length=length, std=std)

    def _calculate_atr(self, params: Dict[str, Any]) -> pd.Series:
        """Calculate Average True Range."""
        length = params.get("length", 14)
        return ta.atr(self.df['high'], self.df['low'], self.df['close'], length=length)

    def calculate_multiple(
        self,
        indicators: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate multiple indicators.

        Args:
            indicators: List of indicator configs with 'name' and 'params'

        Returns:
            Dictionary mapping indicator keys to results
        """
        results = {}

        for indicator_config in indicators:
            name = indicator_config.get("name")
            params = indicator_config.get("params", {})

            if not name:
                continue

            try:
                result = self.calculate(name, params)

                # Create unique key for this indicator configuration
                key = f"{name}_{self.create_hash(name, params)[:8]}"

                # Convert to dict format
                if isinstance(result, pd.Series):
                    results[key] = {
                        "name": name,
                        "params": params,
                        "values": [
                            {"timestamp": idx, "value": float(val)}
                            for idx, val in result.items()
                            if pd.notna(val)
                        ]
                    }
                elif isinstance(result, pd.DataFrame):
                    # For multi-column indicators (MACD, BBands, Stoch)
                    results[key] = {
                        "name": name,
                        "params": params,
                        "columns": {}
                    }
                    for col in result.columns:
                        results[key]["columns"][col] = [
                            {"timestamp": idx, "value": float(val)}
                            for idx, val in result[col].items()
                            if pd.notna(val)
                        ]

            except Exception as e:
                logger.error(f"Error calculating {name}: {e}")
                results[f"{name}_error"] = {"error": str(e)}

        return results


def get_supported_indicators() -> List[Dict[str, Any]]:
    """
    Get list of supported indicators with their parameters.

    Returns:
        List of indicator information
    """
    return [
        {
            "name": "sma",
            "display_name": "Simple Moving Average",
            "category": "trend",
            "params": [
                {"name": "length", "type": "int", "default": 20, "description": "Period length"}
            ]
        },
        {
            "name": "ema",
            "display_name": "Exponential Moving Average",
            "category": "trend",
            "params": [
                {"name": "length", "type": "int", "default": 20, "description": "Period length"}
            ]
        },
        {
            "name": "rsi",
            "display_name": "Relative Strength Index",
            "category": "momentum",
            "params": [
                {"name": "length", "type": "int", "default": 14, "description": "Period length"}
            ]
        },
        {
            "name": "macd",
            "display_name": "MACD",
            "category": "momentum",
            "params": [
                {"name": "fast", "type": "int", "default": 12, "description": "Fast period"},
                {"name": "slow", "type": "int", "default": 26, "description": "Slow period"},
                {"name": "signal", "type": "int", "default": 9, "description": "Signal period"}
            ]
        },
        {
            "name": "stoch",
            "display_name": "Stochastic Oscillator",
            "category": "momentum",
            "params": [
                {"name": "k", "type": "int", "default": 14, "description": "%K period"},
                {"name": "d", "type": "int", "default": 3, "description": "%D period"},
                {"name": "smooth_k", "type": "int", "default": 3, "description": "%K smoothing"}
            ]
        },
        {
            "name": "bbands",
            "display_name": "Bollinger Bands",
            "category": "volatility",
            "params": [
                {"name": "length", "type": "int", "default": 20, "description": "Period length"},
                {"name": "std", "type": "float", "default": 2.0, "description": "Standard deviations"}
            ]
        },
        {
            "name": "atr",
            "display_name": "Average True Range",
            "category": "volatility",
            "params": [
                {"name": "length", "type": "int", "default": 14, "description": "Period length"}
            ]
        }
    ]
