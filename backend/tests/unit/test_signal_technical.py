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
