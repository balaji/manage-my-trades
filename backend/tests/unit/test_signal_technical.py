"""Unit tests for the canonical strategy runtime."""

from datetime import datetime, timedelta

from app.core.strategies.runtime import StrategyRuntime
from app.core.strategies.spec import StrategySpec


def _bars():
    closes = [100, 98, 95, 92, 90, 93, 96, 101, 106, 111, 114, 112, 108, 103, 99, 96, 92, 88, 91, 95]
    bars = []
    start = datetime(2024, 1, 1)
    for index, close in enumerate(closes):
        bars.append(
            {
                "timestamp": start + timedelta(days=index),
                "open": close - 1,
                "high": close + 1,
                "low": close - 2,
                "close": close,
                "volume": 1_000_000,
                "symbol": "SPY",
            }
        )
    return bars


class TestStrategyRuntime:
    def test_rsi_strategy_emits_buy_and_sell_signals(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "RSI Test"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 3}}],
                "rules": {
                    "entry": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": "<",
                        "right": {"source": "constant", "value": 35},
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 65},
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

    def test_filter_rule_blocks_signals_when_not_matched(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "Filtered RSI"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 3}}],
                "rules": {
                    "entry": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": "<",
                        "right": {"source": "constant", "value": 35},
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 65},
                    },
                    "filters": [
                        {
                            "type": "comparison",
                            "left": {"source": "price", "value": "close"},
                            "operator": ">",
                            "right": {"source": "constant", "value": 500},
                        }
                    ],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())

        assert signals == []

    def test_all_entry_suppresses_buy_when_one_condition_never_met(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "All Entry Blocked"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 3}}],
                "rules": {
                    "entry": {
                        "type": "all",
                        "conditions": [
                            {
                                "type": "comparison",
                                "left": {"source": "indicator", "value": "rsi_fast"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 35},
                            },
                            {
                                "type": "comparison",
                                "left": {"source": "price", "value": "close"},
                                "operator": ">",
                                "right": {"source": "constant", "value": 500},
                            },
                        ],
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 65},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())
        buy_signals = [s for s in signals if s["signal_type"] == "buy"]

        assert buy_signals == []

    def test_any_entry_fires_when_at_least_one_condition_met(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "Any Entry"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 3}}],
                "rules": {
                    "entry": {
                        "type": "any",
                        "conditions": [
                            {
                                "type": "comparison",
                                "left": {"source": "indicator", "value": "rsi_fast"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 35},
                            },
                            {
                                "type": "comparison",
                                "left": {"source": "price", "value": "close"},
                                "operator": ">",
                                "right": {"source": "constant", "value": 500},
                            },
                        ],
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 65},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())
        buy_signals = [s for s in signals if s["signal_type"] == "buy"]

        assert len(buy_signals) > 0

    def test_all_entry_emits_buy_when_all_conditions_satisfied(self):
        spec = StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "All Entry Active"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 3}}],
                "rules": {
                    "entry": {
                        "type": "all",
                        "conditions": [
                            {
                                "type": "comparison",
                                "left": {"source": "indicator", "value": "rsi_fast"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 35},
                            },
                            {
                                "type": "comparison",
                                "left": {"source": "price", "value": "close"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 100},
                            },
                        ],
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 65},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )

        signals = StrategyRuntime(spec).generate_signals(_bars())
        buy_signals = [s for s in signals if s["signal_type"] == "buy"]

        assert len(buy_signals) > 0
