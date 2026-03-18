"""
Unit tests for IndicatorCalculator.

Pure math tests — no DB, no network, no async.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from app.core.indicators.calculator import IndicatorCalculator


# ---------------------------------------------------------------------------
# SMA
# ---------------------------------------------------------------------------


class TestSMA:
    def test_sma_default_period(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("sma")
        assert isinstance(result, pd.Series)
        # First 19 values (indices 0–18) must be NaN for window=20
        assert result.iloc[:19].isna().all()
        # Index 19 = mean of first 20 closes
        expected = ohlcv_df["close"].iloc[:20].mean()
        assert abs(result.iloc[19] - expected) < 1e-9

    def test_sma_custom_period(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("sma", {"length": 5})
        assert result.iloc[:4].isna().all()
        expected = ohlcv_df["close"].iloc[:5].mean()
        assert abs(result.iloc[4] - expected) < 1e-9


# ---------------------------------------------------------------------------
# EMA
# ---------------------------------------------------------------------------


class TestEMA:
    def test_ema_returns_series(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("ema")
        assert isinstance(result, pd.Series)

    def test_ema_no_nan_from_index_0(self, ohlcv_df):
        # ewm(adjust=False) initialises from the first data point — no burn-in NaN
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("ema")
        assert result.notna().all()

    def test_ema_shorter_period_more_responsive(self, rising_ohlcv_df):
        calc = IndicatorCalculator(rising_ohlcv_df)
        ema5 = calc.calculate("ema", {"length": 5})
        ema20 = calc.calculate("ema", {"length": 20})
        # On a rising series the shorter EMA tracks the current price more closely
        close = rising_ohlcv_df["close"].values
        last_close = close[-1]
        assert abs(ema5.iloc[-1] - last_close) < abs(ema20.iloc[-1] - last_close)


# ---------------------------------------------------------------------------
# RSI
# ---------------------------------------------------------------------------


class TestRSI:
    def test_rsi_first_length_bars_are_nan(self, ohlcv_df):
        """Verify that the first length bars (default 14) are NaN for warm-up."""
        calc = IndicatorCalculator(ohlcv_df)
        rsi = calc.calculate("rsi")
        assert rsi.iloc[:14].isna().all()
        assert rsi.iloc[14:].notna().any()

    def test_rsi_range_0_to_100(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        rsi = calc.calculate("rsi")
        valid = rsi.dropna()
        assert (valid >= 0).all() and (valid <= 100).all()

    def test_rsi_oversold_on_falling_prices(self, falling_ohlcv_df):
        calc = IndicatorCalculator(falling_ohlcv_df)
        rsi = calc.calculate("rsi")
        # After enough bars the RSI should dip below 30
        assert (rsi.dropna() < 30).any()

    def test_rsi_overbought_on_rising_prices(self, rising_ohlcv_df):
        calc = IndicatorCalculator(rising_ohlcv_df)
        rsi = calc.calculate("rsi")
        assert (rsi.dropna() > 70).any()

    def test_rsi_all_gains_approaches_100(self):
        """Strictly rising prices → losses = 0 → RS = inf → RSI = 100."""
        n = 30
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)]
        close = 100.0 + np.arange(n, dtype=float)
        df = pd.DataFrame(
            {
                "timestamp": dates,
                "open": close,
                "high": close * 1.001,
                "low": close * 0.999,
                "close": close,
                "volume": np.ones(n) * 1_000_000,
            }
        )
        calc = IndicatorCalculator(df)
        rsi = calc.calculate("rsi")
        # All non-NaN values must be exactly 100 (no losses → RS = inf)
        valid = rsi.dropna()
        assert (valid == 100.0).all()


# ---------------------------------------------------------------------------
# MACD
# ---------------------------------------------------------------------------


class TestMACD:
    def test_macd_returns_dataframe(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("macd")
        assert isinstance(result, pd.DataFrame)

    def test_macd_has_three_columns(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("macd")
        assert len(result.columns) == 3

    def test_macd_column_names(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("macd")
        assert "MACD_12_26_9" in result.columns
        assert "MACDh_12_26_9" in result.columns
        assert "MACDs_12_26_9" in result.columns

    def test_macd_histogram_equals_macd_minus_signal(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("macd")
        diff = result["MACD_12_26_9"] - result["MACDs_12_26_9"]
        pd.testing.assert_series_equal(result["MACDh_12_26_9"], diff, check_names=False)


# ---------------------------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------------------------


class TestBollingerBands:
    def _calc(self, ohlcv_df):
        return IndicatorCalculator(ohlcv_df).calculate("bbands")

    def test_bbands_returns_dataframe_5_columns(self, ohlcv_df):
        result = self._calc(ohlcv_df)
        assert isinstance(result, pd.DataFrame)
        assert len(result.columns) == 5

    def test_bbands_ordering(self, ohlcv_df):
        result = self._calc(ohlcv_df)
        valid = result.dropna()
        upper = valid["BBU_20_2.0"]
        middle = valid["BBM_20_2.0"]
        lower = valid["BBL_20_2.0"]
        assert (upper >= middle).all()
        assert (middle >= lower).all()

    def test_bbands_percent_b_range(self, ohlcv_df):
        result = self._calc(ohlcv_df)
        valid = result.dropna()
        pct_b = valid["BBP_20_2.0"]
        # For a random-walk series nearly all points lie inside the bands (0–1)
        inside = pct_b[(pct_b >= 0) & (pct_b <= 1)]
        assert len(inside) / len(pct_b) > 0.8


# ---------------------------------------------------------------------------
# ATR
# ---------------------------------------------------------------------------


class TestATR:
    def test_atr_returns_series(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("atr")
        assert isinstance(result, pd.Series)

    def test_atr_non_negative(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("atr")
        assert (result.dropna() >= 0).all()


# ---------------------------------------------------------------------------
# Stochastic
# ---------------------------------------------------------------------------


class TestStochastic:
    def test_stoch_returns_dataframe(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("stoch")
        assert isinstance(result, pd.DataFrame)

    def test_stoch_two_columns(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("stoch")
        assert len(result.columns) == 2

    def test_stoch_k_range_0_to_100(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        result = calc.calculate("stoch")
        k_col = "STOCHk_14_3_3"
        valid = result[k_col].dropna()
        assert (valid >= 0).all() and (valid <= 100).all()


# ---------------------------------------------------------------------------
# Edge cases & utilities
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_invalid_indicator_raises_value_error(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        with pytest.raises(ValueError, match="Unsupported indicator"):
            calc.calculate("unknown")

    def test_create_hash_deterministic(self):
        h1 = IndicatorCalculator.create_hash("rsi", {"length": 14})
        h2 = IndicatorCalculator.create_hash("rsi", {"length": 14})
        assert h1 == h2

    def test_create_hash_different_params(self):
        h1 = IndicatorCalculator.create_hash("sma", {"length": 10})
        h2 = IndicatorCalculator.create_hash("sma", {"length": 20})
        assert h1 != h2

    def test_calculate_multiple_returns_dict(self, ohlcv_df):
        calc = IndicatorCalculator(ohlcv_df)
        indicators = [
            {"name": "sma", "params": {"length": 20}},
            {"name": "rsi", "params": {"length": 14}},
        ]
        result = calc.calculate_multiple(indicators)
        assert isinstance(result, dict)
        assert len(result) == 2
        keys = list(result.keys())
        assert any(k.startswith("SMA_") for k in keys)
        assert any(k.startswith("RSI_") for k in keys)
        # Verify each result has a 'name' field
        for r in result.values():
            assert "name" in r
            assert r["name"] in ["SMA", "RSI"]

    def test_calculate_multiple_with_multiple_sma_lengths(self, ohlcv_df):
        """Verify that multiple SMAs with different lengths produce distinct hash-based keys."""
        calc = IndicatorCalculator(ohlcv_df)
        indicators = [
            {"name": "sma", "params": {"length": 10}},
            {"name": "sma", "params": {"length": 20}},
            {"name": "sma", "params": {"length": 30}},
            {"name": "ema", "params": {"length": 10}},
            {"name": "ema", "params": {"length": 20}},
            {"name": "ema", "params": {"length": 30}},
        ]
        result = calc.calculate_multiple(indicators)
        assert isinstance(result, dict)
        assert len(result) == 6

        # All keys should be distinct and start with SMA_ or EMA_
        keys = list(result.keys())
        sma_keys = [k for k in keys if k.startswith("SMA_")]
        ema_keys = [k for k in keys if k.startswith("EMA_")]

        assert len(sma_keys) == 3
        assert len(ema_keys) == 3
        assert len(set(keys)) == 6  # All keys are unique

        # Verify params match
        sma_results = [r for k, r in result.items() if k.startswith("SMA_")]
        sma_lengths = sorted([r["params"]["length"] for r in sma_results])
        assert sma_lengths == [10, 20, 30]


# ---------------------------------------------------------------------------
# Signal generation flow (integration with TechnicalAnalysisService)
# ---------------------------------------------------------------------------


class TestSignalGenerationFlow:
    """Test the signal generation flow including indicator calculation and bar alignment."""

    def test_calculate_indicators_with_bars_returns_hash_keyed_results(self, ohlcv_df):
        """Verify that calculate_multiple returns keys like 'RSI_<hash>' not just 'rsi'."""
        from app.services.technical_analysis_service import TechnicalAnalysisService

        # Create a mock market_db (we'll just pass None since TechnicalAnalysisService doesn't use it for calculate_indicators_with_bars)
        service = TechnicalAnalysisService(None)
        result = service.calculate_indicators_with_bars(
            symbol="TEST",
            bars_data=ohlcv_df.to_dict("records"),
            timeframe="1d",
            indicators=[{"name": "rsi", "params": {"length": 14}}],
        )

        indicators = result.get("indicators", {})
        # Should have exactly one key starting with "RSI_"
        rsi_keys = [k for k in indicators.keys() if k.startswith("RSI_")]
        assert len(rsi_keys) == 1
        # The key format is RSI_<hash> (8-char hash)
        assert "_" in rsi_keys[0]

    def test_calculate_indicators_with_bars_strips_nans(self, falling_ohlcv_df):
        """Verify that indicator values strip NaN entries."""
        from app.services.technical_analysis_service import TechnicalAnalysisService

        service = TechnicalAnalysisService(None)
        result = service.calculate_indicators_with_bars(
            symbol="TEST",
            bars_data=falling_ohlcv_df.to_dict("records"),
            timeframe="1d",
            indicators=[{"name": "rsi", "params": {"length": 14}}],
        )

        indicators = result.get("indicators", {})
        rsi_key = [k for k in indicators.keys() if k.startswith("RSI_")][0]
        values = indicators[rsi_key].get("values", [])

        # Values should have fewer entries than bars due to NaN stripping
        assert len(values) < len(falling_ohlcv_df)
        # All values should have timestamp and value keys
        for v in values:
            assert "timestamp" in v
            assert "value" in v

    def test_indicator_timestamp_alignment(self, falling_ohlcv_df):
        """Verify that indicator values can be correctly aligned with bars by timestamp."""
        from app.services.technical_analysis_service import TechnicalAnalysisService

        service = TechnicalAnalysisService(None)
        bars_data = falling_ohlcv_df.to_dict("records")
        result = service.calculate_indicators_with_bars(
            symbol="TEST",
            bars_data=bars_data,
            timeframe="1d",
            indicators=[{"name": "rsi", "params": {"length": 14}}],
        )

        indicators = result.get("indicators", {})
        rsi_key = [k for k in indicators.keys() if k.startswith("RSI_")][0]
        values = indicators[rsi_key].get("values", [])

        # Create timestamp->value map
        value_map = {entry["timestamp"]: entry["value"] for entry in values}

        # All bar timestamps that have values should be in the map
        for bar in bars_data:
            ts = bar["timestamp"]
            if ts in value_map:
                # Should be able to retrieve it correctly
                assert isinstance(value_map[ts], (int, float))
                assert not pd.isna(value_map[ts])

    def test_calculate_strategy_indicators_finds_hash_keyed_results(self, falling_ohlcv_df):
        """Test that _calculate_strategy_indicators correctly maps hash-keyed results to indicator names."""
        from unittest.mock import MagicMock
        from app.services.signal_service import SignalService
        from app.models.strategy import Strategy

        # Create mock strategy with RSI indicator config
        strategy = MagicMock(spec=Strategy)
        strategy.indicators = []

        # Create a mock indicator config
        indicator_config = MagicMock()
        indicator_config.indicator_name = "rsi"
        indicator_config.parameters = {"length": 14}
        strategy.indicators.append(indicator_config)

        # Create signal service with mocked DBs
        signal_service = SignalService(None, None)

        # Convert falling OHLCV to bar data format
        bars_data = falling_ohlcv_df.to_dict("records")

        # Call _calculate_strategy_indicators
        indicator_values = signal_service._calculate_strategy_indicators(strategy, "TEST", bars_data)

        # Should have the "rsi" key (not RSI_<hash>)
        assert "rsi" in indicator_values
        # The values should be a list (or could be a dict with timestamp->value mapping)
        assert len(indicator_values["rsi"]) > 0

    def test_signal_generation_produces_signals_for_rsi_strategy(self, falling_ohlcv_df):
        """Test that signal generation produces non-zero signals for RSI oversold condition."""
        from unittest.mock import MagicMock, AsyncMock
        from app.services.signal_service import SignalService
        from app.models.strategy import Strategy

        # Create mock strategy with RSI indicator
        strategy = MagicMock(spec=Strategy)
        strategy.id = 1
        strategy.strategy_type = "technical"

        # Create a mock indicator config
        indicator_config = MagicMock()
        indicator_config.indicator_name = "rsi"
        indicator_config.parameters = {"length": 14}
        strategy.indicators = [indicator_config]

        # Set strategy config for entry/exit thresholds
        strategy.config = {"entry_threshold": 30, "exit_threshold": 70}

        # Create signal service with mocked DBs
        db = MagicMock()
        db.add = MagicMock()
        db.commit = AsyncMock()

        signal_service = SignalService(db, None)

        # Convert falling OHLCV to bar data format (has oversold RSI values)
        bars_data = falling_ohlcv_df.to_dict("records")

        # Call generate_signals (note: this is async)
        # We need to handle the async call differently
        import asyncio

        signals = asyncio.run(signal_service.generate_signals(strategy, "TEST", bar_data=bars_data))

        # With a falling market (oversold RSI), should generate buy signals
        assert len(signals) > 0
