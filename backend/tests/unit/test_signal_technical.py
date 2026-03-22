"""Unit tests for the canonical strategy runtime."""

from datetime import datetime, timedelta

from app.core.strategies.runtime import StrategyRuntime
from app.core.strategies.spec import StrategySpec


def _bars():
    closes = [10, 9, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 8, 9, 10]
    bars = []
    start = datetime(2024, 1, 1)
    for index, close in enumerate(closes):
        bars.append(
            {
                "timestamp": start + timedelta(days=index),
                "open": close - 0.5,
                "high": close + 1,
                "low": close - 1,
                "close": close,
                "volume": 1_000_000 + index,
                "symbol": "SPY",
            }
        )
    return bars


class TestStrategyRuntime:
    def test_ma_cross_strategy_emits_buy_and_sell_signals(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "MA Cross Test"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [
                    {"alias": "fast_ma", "indicator": "ema", "params": {"length": 2}},
                    {"alias": "slow_ma", "indicator": "sma", "params": {"length": 4}},
                ],
                "rules": {
                    "entry": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": "crosses_above",
                        "right": {"type": "indicator", "alias": "slow_ma"},
                    },
                    "exit": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": "crosses_below",
                        "right": {"type": "indicator", "alias": "slow_ma"},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())
        signal_types = {signal["signal_type"] for signal in signals}

        assert "buy" in signal_types
        assert "sell" in signal_types

    def test_macd_cross_rule_uses_named_fields(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "MACD Cross"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [
                    {"alias": "macd_fast", "indicator": "macd", "params": {"fast": 3, "slow": 6, "signal": 2}}
                ],
                "rules": {
                    "entry": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "macd_fast", "field": "macd"},
                        "operator": "crosses_above",
                        "right": {"type": "indicator", "alias": "macd_fast", "field": "signal"},
                    },
                    "exit": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "macd_fast", "field": "macd"},
                        "operator": "crosses_below",
                        "right": {"type": "indicator", "alias": "macd_fast", "field": "signal"},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())

        assert len(signals) > 0
        assert any("macd" in (signal["indicators"]["macd_fast"] or {}) for signal in signals)

    def test_prev_expression_can_compare_against_current_value(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "Price Momentum"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "fast_ma", "indicator": "ema", "params": {"length": 2}}],
                "rules": {
                    "entry": {
                        "type": "compare",
                        "left": {"type": "price", "field": "close"},
                        "operator": ">",
                        "right": {"type": "prev", "expr": {"type": "price", "field": "close"}},
                    },
                    "exit": {
                        "type": "compare",
                        "left": {"type": "price", "field": "close"},
                        "operator": "<",
                        "right": {"type": "prev", "expr": {"type": "price", "field": "close"}},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())

        assert any(signal["signal_type"] == "buy" for signal in signals)
        assert any(signal["signal_type"] == "sell" for signal in signals)

    def test_filter_rule_blocks_signals_when_not_matched(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "Filtered Cross"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [
                    {"alias": "fast_ma", "indicator": "ema", "params": {"length": 2}},
                    {"alias": "slow_ma", "indicator": "sma", "params": {"length": 4}},
                ],
                "rules": {
                    "entry": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": "crosses_above",
                        "right": {"type": "indicator", "alias": "slow_ma"},
                    },
                    "exit": {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": "crosses_below",
                        "right": {"type": "indicator", "alias": "slow_ma"},
                    },
                    "filters": [
                        {
                            "type": "compare",
                            "left": {"type": "price", "field": "close"},
                            "operator": ">",
                            "right": {"type": "constant", "value": 500},
                        }
                    ],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())

        assert signals == []

    def test_first_bar_never_fires_prev_dependent_rule(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "First Bar Guard"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "fast_ma", "indicator": "ema", "params": {"length": 2}}],
                "rules": {
                    "entry": {
                        "type": "compare",
                        "left": {"type": "price", "field": "close"},
                        "operator": ">",
                        "right": {"type": "prev", "expr": {"type": "price", "field": "close"}},
                    },
                    "exit": {
                        "type": "compare",
                        "left": {"type": "price", "field": "close"},
                        "operator": "<",
                        "right": {"type": "constant", "value": 0},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())

        assert all(signal["timestamp"] != _bars()[0]["timestamp"] for signal in signals)
