"""Unit tests for strategy spec validation and legacy adaptation."""

import pytest

from app.core.strategies.spec import LogicalRule, StrategySpec


def _base_spec(entry_rule: dict, exit_rule: dict | None = None, indicators: list | None = None) -> dict:
    return {
        "kind": "technical",
        "metadata": {"name": "Test"},
        "market": {"timeframe": "1d", "symbols": ["SPY"]},
        "indicators": indicators
        or [
            {"alias": "rsi", "indicator": "rsi", "params": {"length": 14}},
            {"alias": "sma", "indicator": "sma", "params": {"length": 50}},
        ],
        "rules": {
            "entry": entry_rule,
            "exit": exit_rule
            or {
                "type": "comparison",
                "left": {"source": "indicator", "value": "rsi"},
                "operator": ">",
                "right": {"source": "constant", "value": 70},
            },
            "filters": [],
        },
        "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
        "execution": {},
    }


def test_logical_rule_all_requires_every_condition():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "all",
                "conditions": [
                    {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi"},
                        "operator": "<",
                        "right": {"source": "constant", "value": 30},
                    },
                    {
                        "type": "comparison",
                        "left": {"source": "price", "value": "close"},
                        "operator": "<",
                        "right": {"source": "indicator", "value": "sma"},
                    },
                ],
            }
        )
    )
    assert isinstance(spec.rules.entry, LogicalRule)
    assert spec.rules.entry.type == "all"
    assert len(spec.rules.entry.conditions) == 2


def test_logical_rule_any_requires_one_condition():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "any",
                "conditions": [
                    {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "rsi"},
                        "operator": "<",
                        "right": {"source": "constant", "value": 30},
                    },
                    {
                        "type": "comparison",
                        "left": {"source": "indicator", "value": "bb", "field": "lower"},
                        "operator": ">",
                        "right": {"source": "price", "value": "close"},
                    },
                ],
            },
            indicators=[
                {"alias": "rsi", "indicator": "rsi", "params": {"length": 14}},
                {"alias": "bb", "indicator": "bollinger_bands", "params": {"length": 20}},
            ],
            exit_rule={
                "type": "comparison",
                "left": {"source": "indicator", "value": "rsi"},
                "operator": ">",
                "right": {"source": "constant", "value": 70},
            },
        )
    )
    assert isinstance(spec.rules.entry, LogicalRule)
    assert spec.rules.entry.type == "any"
    assert len(spec.rules.entry.conditions) == 2


def test_logical_rule_nesting():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "all",
                "conditions": [
                    {
                        "type": "any",
                        "conditions": [
                            {
                                "type": "comparison",
                                "left": {"source": "indicator", "value": "rsi"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 30},
                            },
                            {
                                "type": "comparison",
                                "left": {"source": "indicator", "value": "rsi"},
                                "operator": "<",
                                "right": {"source": "constant", "value": 25},
                            },
                        ],
                    },
                    {
                        "type": "comparison",
                        "left": {"source": "price", "value": "close"},
                        "operator": "<",
                        "right": {"source": "indicator", "value": "sma"},
                    },
                ],
            }
        )
    )
    assert isinstance(spec.rules.entry, LogicalRule)
    assert spec.rules.entry.type == "all"
    inner = spec.rules.entry.conditions[0]
    assert isinstance(inner, LogicalRule)
    assert inner.type == "any"


def test_logical_rule_rejects_empty_conditions():
    with pytest.raises(ValueError, match="require at least one condition"):
        StrategySpec.model_validate(
            _base_spec(
                entry_rule={"type": "all", "conditions": []},
            )
        )


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
