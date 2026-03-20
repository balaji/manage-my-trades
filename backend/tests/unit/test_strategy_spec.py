"""Unit tests for strategy spec validation and legacy adaptation."""

import pytest

from app.core.strategies.legacy import build_legacy_spec
from app.core.strategies.spec import StrategySpec


def test_strategy_spec_rejects_unknown_alias_reference():
    with pytest.raises(ValueError, match="Unknown indicator alias"):
        StrategySpec.model_validate(
            {
                "kind": "technical",
                "metadata": {"name": "Broken"},
                "market": {"timeframe": "1d", "symbols": ["SPY"]},
                "indicators": [{"alias": "rsi_fast", "indicator": "rsi", "params": {"length": 14}}],
                "rules": {
                    "entry": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "missing_alias"},
                        "operator": "<",
                        "right": {"source": "constant", "value": 30},
                    },
                    "exit": {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi_fast"},
                        "operator": ">",
                        "right": {"source": "constant", "value": 70},
                    },
                    "filters": [],
                },
                "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                "execution": {},
            }
        )


def test_build_legacy_spec_from_rsi_config():
    spec = build_legacy_spec(
        name="RSI Mean Reversion",
        description="Buy oversold, sell overbought",
        config={"entry_threshold": 30, "exit_threshold": 70},
        indicators=[{"indicator_name": "rsi", "parameters": {"period": 14}, "usage": "entry"}],
    )

    assert spec.metadata.name == "RSI Mean Reversion"
    assert spec.indicators[0].indicator == "rsi"
    assert spec.rules.entry.operator == "<"
    assert spec.rules.exit.operator == ">"
