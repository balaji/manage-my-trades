"""
Unit tests for SignalService._evaluate_technical_strategy().

Called directly — no DB, no async, no fixtures beyond simple dicts.
"""

from app.services.signal_service import SignalService

# We call the method as an unbound function to avoid needing a real DB session.
_evaluate = SignalService._evaluate_technical_strategy

# Minimal bar dict (unused by the technical evaluator but required by signature)
BAR = {"open": 100.0, "high": 105.0, "low": 95.0, "close": 100.0, "volume": 1_000_000}


# ---------------------------------------------------------------------------
# RSI branch
# ---------------------------------------------------------------------------


class TestRSIBranch:
    def test_rsi_buy_signal(self):
        signal_type, _, _ = _evaluate(None, {}, {"rsi": 25}, BAR)
        assert signal_type == "buy"

    def test_rsi_sell_signal(self):
        signal_type, _, _ = _evaluate(None, {}, {"rsi": 75}, BAR)
        assert signal_type == "sell"

    def test_rsi_hold_signal(self):
        signal_type, _, _ = _evaluate(None, {}, {"rsi": 50}, BAR)
        assert signal_type is None

    def test_rsi_boundary_at_entry(self):
        # RSI == entry_threshold is NOT strictly less-than → no signal
        signal_type, _, _ = _evaluate(None, {}, {"rsi": 30}, BAR)
        assert signal_type is None

    def test_rsi_boundary_at_exit(self):
        # RSI == exit_threshold is NOT strictly greater-than → no signal
        signal_type, _, _ = _evaluate(None, {}, {"rsi": 70}, BAR)
        assert signal_type is None

    def test_rsi_buy_strength(self):
        # strength = (entry - rsi) / entry = (30 - 20) / 30
        _, strength, _ = _evaluate(None, {}, {"rsi": 20}, BAR)
        assert abs(strength - (30 - 20) / 30) < 1e-9

    def test_rsi_sell_strength(self):
        # strength = (rsi - exit) / (100 - exit) = (80 - 70) / (100 - 70)
        _, strength, _ = _evaluate(None, {}, {"rsi": 80}, BAR)
        assert abs(strength - (80 - 70) / (100 - 70)) < 1e-9

    def test_rsi_custom_thresholds(self):
        config = {"entry_threshold": 40, "exit_threshold": 60}
        signal_type, _, _ = _evaluate(None, config, {"rsi": 35}, BAR)
        assert signal_type == "buy"

    def test_rsi_metadata_reason(self):
        _, _, metadata = _evaluate(None, {}, {"rsi": 25}, BAR)
        assert "RSI" in metadata.get("reason", "")

    def test_rsi_none_value(self):
        signal_type, _, _ = _evaluate(None, {}, {"rsi": None}, BAR)
        assert signal_type is None

    def test_rsi_takes_precedence_over_macd(self):
        # When rsi key is present and non-None, RSI branch fires
        indicators = {"rsi": 25, "macd": {"histogram": -5}}
        signal_type, _, metadata = _evaluate(None, {}, indicators, BAR)
        assert signal_type == "buy"
        assert "RSI" in metadata.get("reason", "")


# ---------------------------------------------------------------------------
# MACD branch
# ---------------------------------------------------------------------------


class TestMACDBranch:
    def test_macd_buy_histogram_positive(self):
        signal_type, _, _ = _evaluate(None, {}, {"macd": {"histogram": 0.5}}, BAR)
        assert signal_type == "buy"

    def test_macd_sell_histogram_negative(self):
        signal_type, _, _ = _evaluate(None, {}, {"macd": {"histogram": -0.5}}, BAR)
        assert signal_type == "sell"

    def test_macd_hold_histogram_zero(self):
        signal_type, _, _ = _evaluate(None, {}, {"macd": {"histogram": 0}}, BAR)
        assert signal_type is None

    def test_macd_strength_capped_at_1(self):
        _, strength, _ = _evaluate(None, {}, {"macd": {"histogram": 100}}, BAR)
        assert strength == 1.0

    def test_macd_non_dict_value(self):
        # MACD value is a scalar, not a dict → no signal
        signal_type, _, _ = _evaluate(None, {}, {"macd": 1.5}, BAR)
        assert signal_type is None


# ---------------------------------------------------------------------------
# SMA/EMA crossover branch
# ---------------------------------------------------------------------------


class TestSMAEMACrossover:
    def test_ema_above_sma_golden_cross(self):
        signal_type, _, _ = _evaluate(None, {}, {"sma": 100, "ema": 105}, BAR)
        assert signal_type == "buy"

    def test_ema_below_sma_death_cross(self):
        signal_type, _, _ = _evaluate(None, {}, {"sma": 100, "ema": 95}, BAR)
        assert signal_type == "sell"

    def test_sma_ema_equal_no_signal(self):
        signal_type, _, _ = _evaluate(None, {}, {"sma": 100, "ema": 100}, BAR)
        assert signal_type is None

    def test_sma_ema_strength(self):
        # strength = abs(ema - sma) / sma = abs(110 - 100) / 100 = 0.1
        _, strength, _ = _evaluate(None, {}, {"sma": 100, "ema": 110}, BAR)
        assert abs(strength - 0.1) < 1e-9


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_no_indicators_no_signal(self):
        signal_type, _, _ = _evaluate(None, {}, {}, BAR)
        assert signal_type is None
