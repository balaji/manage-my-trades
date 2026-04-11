"""Tests for HMM-based regime detection."""

from datetime import date
import numpy as np
import pandas as pd

from app.core.regime_detector import RegimeDetector


def _make_ohlcv(prices: list[float], start: str = "2024-01-01") -> pd.DataFrame:
    """Build a synthetic OHLCV DataFrame from a list of close prices."""
    n = len(prices)
    timestamps = pd.date_range(start, periods=n, freq="B")
    close = np.array(prices, dtype=float)
    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "open": close * 0.999,
            "high": close * 1.005,
            "low": close * 0.995,
            "close": close,
            "volume": np.random.default_rng(42).integers(1_000_000, 5_000_000, size=n),
        }
    )


def _trending_up(n: int, start: float = 100.0) -> list[float]:
    rng = np.random.default_rng(1)
    prices = [start]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + abs(rng.normal(0.002, 0.005))))
    return prices


def _trending_down(n: int, start: float = 100.0) -> list[float]:
    rng = np.random.default_rng(2)
    prices = [start]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 - abs(rng.normal(0.002, 0.005))))
    return prices


def _sideways(n: int, center: float = 100.0) -> list[float]:
    rng = np.random.default_rng(3)
    return [center + rng.normal(0, 0.5) for _ in range(n)]


class TestRegimeDetector:
    def test_returns_segments_for_valid_data(self):
        prices = _trending_up(60) + _trending_down(60) + _sideways(60)
        df = _make_ohlcv(prices)
        detector = RegimeDetector(n_regimes=3)
        segments = detector.detect(df)

        assert len(segments) > 0
        for seg in segments:
            assert "start" in seg
            assert "end" in seg
            assert seg["regime"] in ("bullish", "bearish", "sideways")

    def test_segments_are_contiguous(self):
        prices = _trending_up(80) + _trending_down(80)
        df = _make_ohlcv(prices)
        detector = RegimeDetector(n_regimes=2)
        segments = detector.detect(df)

        assert len(segments) >= 1
        for i in range(1, len(segments)):
            assert segments[i]["start"] > segments[i - 1]["end"]

    def test_two_regimes_uses_correct_labels(self):
        prices = _trending_up(80) + _trending_down(80)
        df = _make_ohlcv(prices)
        detector = RegimeDetector(n_regimes=2)
        segments = detector.detect(df)

        labels = {seg["regime"] for seg in segments}
        assert labels <= {"bullish", "bearish"}

    def test_insufficient_data_returns_empty(self):
        df = _make_ohlcv([100.0, 101.0, 102.0])
        detector = RegimeDetector(n_regimes=3)
        segments = detector.detect(df)

        assert segments == []

    def test_accepts_date_timestamps_from_cached_market_data(self):
        prices = _trending_up(60) + _trending_down(60) + _sideways(60)
        df = _make_ohlcv(prices)
        df["timestamp"] = [
            ts.date() if isinstance(ts, pd.Timestamp) else date.fromisoformat(str(ts)) for ts in df["timestamp"]
        ]
        detector = RegimeDetector(n_regimes=3)

        segments = detector.detect(df)

        assert len(segments) > 0
        assert all(seg["start"].time().isoformat() == "00:00:00" for seg in segments)
        assert all(seg["end"].time().isoformat() == "00:00:00" for seg in segments)


class TestRegimeDetectorRegimeType:
    DIRECTIONAL_LABELS = {"bullish", "bearish", "sideways"}
    VOL_LABELS_3 = {"low_vol", "normal_vol", "high_vol"}
    VOL_LABELS_2 = {"low_vol", "high_vol"}
    COMBINED_LABELS = {"bearish_high_vol", "bearish_low_vol", "bullish_low_vol", "bullish_high_vol"}

    def _base_prices(self) -> list[float]:
        return _trending_up(60) + _trending_down(60) + _sideways(60)

    def _combined_prices(self) -> list[float]:
        # 240 bars with distinct directional + volatility regimes
        return _trending_up(60) + _trending_down(60) + _sideways(60) + _trending_up(60)

    def test_directional_default_preserves_existing_labels(self):
        df = _make_ohlcv(self._base_prices())
        segments = RegimeDetector(n_regimes=3).detect(df)
        labels = {seg["regime"] for seg in segments}
        assert labels <= self.DIRECTIONAL_LABELS

    def test_directional_explicit_3regime(self):
        df = _make_ohlcv(self._base_prices())
        segments = RegimeDetector(n_regimes=3, regime_type="directional").detect(df)
        labels = {seg["regime"] for seg in segments}
        assert labels <= self.DIRECTIONAL_LABELS

    def test_directional_explicit_2regime(self):
        df = _make_ohlcv(_trending_up(80) + _trending_down(80))
        segments = RegimeDetector(n_regimes=2, regime_type="directional").detect(df)
        labels = {seg["regime"] for seg in segments}
        assert labels <= {"bullish", "bearish"}

    def test_volatility_3regime_uses_vol_labels(self):
        df = _make_ohlcv(self._base_prices())
        segments = RegimeDetector(n_regimes=3, regime_type="volatility").detect(df)
        labels = {seg["regime"] for seg in segments}
        assert labels <= self.VOL_LABELS_3

    def test_volatility_2regime_uses_vol_labels(self):
        df = _make_ohlcv(_trending_up(80) + _trending_down(80))
        segments = RegimeDetector(n_regimes=2, regime_type="volatility").detect(df)
        labels = {seg["regime"] for seg in segments}
        assert labels <= self.VOL_LABELS_2

    def test_volatility_segments_contain_only_vol_labels(self):
        df = _make_ohlcv(self._base_prices())
        segments = RegimeDetector(n_regimes=3, regime_type="volatility").detect(df)
        assert len(segments) > 0
        assert all(seg["regime"] in self.VOL_LABELS_3 for seg in segments)

    def test_combined_requires_n_regimes_4(self):
        import pytest

        df = _make_ohlcv(self._base_prices())
        detector = RegimeDetector(n_regimes=3, regime_type="combined")
        with pytest.raises(ValueError, match="n_regimes=4"):
            detector.detect(df)

    def test_combined_4regime_uses_combined_labels(self):
        df = _make_ohlcv(self._combined_prices())
        segments = RegimeDetector(n_regimes=4, regime_type="combined").detect(df)
        assert len(segments) >= 1
        labels = {seg["regime"] for seg in segments}
        assert labels <= self.COMBINED_LABELS

    def test_invalid_regime_type_raises_value_error(self):
        import pytest

        with pytest.raises(ValueError):
            RegimeDetector(regime_type="momentum")
