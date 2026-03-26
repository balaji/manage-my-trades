"""Unit tests for strategy spec validation."""

import pytest

from app.core.strategies.spec import CrossRule, LogicalRule, PrevExpr, StrategySpec


def _base_spec(entry_rule: dict, exit_rule: dict | None = None, indicators: list | None = None) -> dict:
    return {
        "kind": "technical",
        "metadata": {"name": "Test"},
        "market": {"timeframe": "1d", "symbols": ["SPY"]},
        "indicators": indicators
        or [
            {"alias": "fast_ma", "indicator": "EMA", "params": {"timeperiod": 20}},
            {"alias": "slow_ma", "indicator": "SMA", "params": {"timeperiod": 50}},
        ],
        "rules": {
            "entry": entry_rule,
            "exit": exit_rule
            or {
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


def test_logical_rule_all_requires_every_condition():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "all",
                "conditions": [
                    {
                        "type": "compare",
                        "left": {"type": "price", "field": "close"},
                        "operator": "<",
                        "right": {"type": "indicator", "alias": "slow_ma"},
                    },
                    {
                        "type": "cross",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": "crosses_above",
                        "right": {"type": "indicator", "alias": "slow_ma"},
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
                        "type": "compare",
                        "left": {"type": "indicator", "alias": "fast_ma"},
                        "operator": ">",
                        "right": {"type": "constant", "value": 0},
                    },
                    {
                        "type": "compare",
                        "left": {"type": "indicator", "alias": "macd_fast", "field": "macd"},
                        "operator": ">",
                        "right": {"type": "indicator", "alias": "macd_fast", "field": "macdsignal"},
                    },
                ],
            },
            indicators=[
                {"alias": "fast_ma", "indicator": "EMA", "params": {"timeperiod": 20}},
                {
                    "alias": "macd_fast",
                    "indicator": "MACD",
                    "params": {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9},
                },
            ],
            exit_rule={
                "type": "compare",
                "left": {"type": "indicator", "alias": "fast_ma"},
                "operator": "<",
                "right": {"type": "constant", "value": 0},
            },
        )
    )
    assert isinstance(spec.rules.entry, LogicalRule)
    assert spec.rules.entry.type == "any"
    assert len(spec.rules.entry.conditions) == 2


def test_cross_rule_supports_indicator_fields():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "cross",
                "left": {"type": "indicator", "alias": "macd_fast", "field": "macd"},
                "operator": "crosses_above",
                "right": {"type": "indicator", "alias": "macd_fast", "field": "macdsignal"},
            },
            indicators=[
                {
                    "alias": "macd_fast",
                    "indicator": "MACD",
                    "params": {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9},
                },
                {"alias": "slow_ma", "indicator": "SMA", "params": {"timeperiod": 50}},
            ],
            exit_rule={
                "type": "cross",
                "left": {"type": "indicator", "alias": "macd_fast", "field": "macd"},
                "operator": "crosses_below",
                "right": {"type": "indicator", "alias": "macd_fast", "field": "macdsignal"},
            },
        )
    )
    assert isinstance(spec.rules.entry, CrossRule)
    assert spec.rules.entry.left.field == "macd"
    assert spec.rules.entry.right.field == "macdsignal"


def test_prev_expression_is_supported():
    spec = StrategySpec.model_validate(
        _base_spec(
            entry_rule={
                "type": "compare",
                "left": {"type": "indicator", "alias": "fast_ma"},
                "operator": ">",
                "right": {"type": "prev", "expr": {"type": "indicator", "alias": "slow_ma"}},
            }
        )
    )
    assert isinstance(spec.rules.entry.right, PrevExpr)


def test_logical_rule_rejects_empty_conditions():
    with pytest.raises(ValueError, match="require at least one condition"):
        StrategySpec.model_validate(_base_spec(entry_rule={"type": "all", "conditions": []}))


def test_strategy_spec_rejects_unknown_alias_reference():
    with pytest.raises(ValueError, match="Unknown indicator alias"):
        StrategySpec.model_validate(
            _base_spec(
                entry_rule={
                    "type": "compare",
                    "left": {"type": "indicator", "alias": "missing_alias"},
                    "operator": "<",
                    "right": {"type": "constant", "value": 30},
                }
            )
        )


def test_strategy_spec_rejects_missing_indicator_field():
    with pytest.raises(ValueError, match="requires one of fields"):
        StrategySpec.model_validate(
            _base_spec(
                entry_rule={
                    "type": "compare",
                    "left": {"type": "indicator", "alias": "macd_fast"},
                    "operator": ">",
                    "right": {"type": "constant", "value": 0},
                },
                indicators=[
                    {
                        "alias": "macd_fast",
                        "indicator": "MACD",
                        "params": {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9},
                    },
                    {"alias": "slow_ma", "indicator": "SMA", "params": {"timeperiod": 50}},
                ],
            )
        )


def test_strategy_spec_rejects_nested_prev():
    with pytest.raises(ValueError, match="Nested prev\\(\\) expressions are not supported"):
        StrategySpec.model_validate(
            _base_spec(
                entry_rule={
                    "type": "compare",
                    "left": {
                        "type": "prev",
                        "expr": {"type": "prev", "expr": {"type": "indicator", "alias": "fast_ma"}},
                    },
                    "operator": ">",
                    "right": {"type": "indicator", "alias": "slow_ma"},
                }
            )
        )
