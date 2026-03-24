"""Unit tests for the TA-Lib-backed indicator calculator."""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from app.core.indicators.calculator import IndicatorCalculator, get_supported_indicators


class TestSingleOutputIndicators:
    def test_sma_uses_talib_parameter_names(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate("SMA", {"timeperiod": 5})
        assert isinstance(result, pd.Series)
        assert result.name == "real"
        assert result.iloc[:4].isna().all()
        assert abs(result.iloc[4] - ohlcv_df["close"].iloc[:5].mean()) < 1e-9

    def test_ema_returns_named_series(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate("EMA", {"timeperiod": 20})
        assert isinstance(result, pd.Series)
        assert result.name == "real"
        assert result.iloc[:19].isna().all()
        assert result.iloc[19:].notna().all()

    def test_rsi_stays_in_expected_range(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate("RSI", {"timeperiod": 14})
        valid = result.dropna()
        assert (valid >= 0).all() and (valid <= 100).all()

    def test_pattern_indicator_is_supported(self):
        n = 30
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)]
        close = 100.0 + np.arange(n, dtype=float)
        df = pd.DataFrame(
            {
                "timestamp": dates,
                "open": close,
                "high": close + 1,
                "low": close - 1,
                "close": close,
                "volume": np.ones(n) * 1_000_000,
            }
        )
        result = IndicatorCalculator(df).calculate("CDLDOJI")
        assert isinstance(result, pd.Series)
        assert result.name == "integer"


class TestMultiOutputIndicators:
    def test_macd_returns_talib_output_names(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate(
            "MACD", {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9}
        )
        assert isinstance(result, pd.DataFrame)
        assert list(result.columns) == ["macd", "macdsignal", "macdhist"]

    def test_bbands_returns_talib_output_names(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate("BBANDS", {"timeperiod": 20, "nbdevup": 2, "nbdevdn": 2})
        assert isinstance(result, pd.DataFrame)
        assert list(result.columns) == ["upperband", "middleband", "lowerband"]

    def test_stoch_returns_talib_output_names(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate("STOCH")
        assert isinstance(result, pd.DataFrame)
        assert list(result.columns) == ["slowk", "slowd"]


class TestRegistryAndBatchCalculation:
    def test_supported_indicators_include_pattern_and_overlap_functions(self):
        indicators = get_supported_indicators()
        names = {indicator["name"] for indicator in indicators}
        assert "SMA" in names
        assert "MACD" in names
        assert "CDLDOJI" in names

    def test_calculate_multiple_returns_uniform_outputs_shape(self, ohlcv_df):
        result = IndicatorCalculator(ohlcv_df).calculate_multiple(
            [
                {"name": "SMA", "params": {"timeperiod": 20}},
                {"name": "MACD", "params": {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9}},
            ]
        )

        assert isinstance(result, list)
        assert [item["name"] for item in result] == ["SMA", "MACD"]
        assert "real" in result[0]["outputs"]
        assert {"macd", "macdsignal", "macdhist"} == set(result[1]["outputs"].keys())


class TestEdgeCases:
    def test_invalid_indicator_raises_value_error(self, ohlcv_df):
        with pytest.raises(ValueError, match="Unsupported indicator"):
            IndicatorCalculator(ohlcv_df).calculate("UNKNOWN")

    def test_create_hash_is_deterministic(self):
        h1 = IndicatorCalculator.create_hash("RSI", {"timeperiod": 14})
        h2 = IndicatorCalculator.create_hash("RSI", {"timeperiod": 14})
        assert h1 == h2
