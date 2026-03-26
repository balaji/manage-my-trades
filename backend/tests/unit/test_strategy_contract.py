"""Unit tests for strategy API schema and serialization contracts."""

from types import SimpleNamespace

import pytest
from sqlalchemy.orm import configure_mappers

from app.api.v1.endpoints.strategies import serialize_strategy
from app.models import Backtest, Strategy
from app.schemas.strategy import StrategyCreate, StrategyUpdate


def _spec() -> dict:
    return {
        "kind": "technical",
        "metadata": {"name": "RSI Mean Reversion", "description": "Buy low, sell high"},
        "market": {"timeframe": "1d"},
        "indicators": [{"alias": "rsi_fast", "indicator": "RSI", "params": {"timeperiod": 14}}],
        "rules": {
            "entry": {
                "type": "compare",
                "left": {"type": "indicator", "alias": "rsi_fast"},
                "operator": "<",
                "right": {"type": "constant", "value": 30},
            },
            "exit": {
                "type": "compare",
                "left": {"type": "indicator", "alias": "rsi_fast"},
                "operator": ">",
                "right": {"type": "constant", "value": 70},
            },
            "filters": [],
        },
        "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
        "execution": {},
    }


def test_strategy_create_rejects_legacy_indicators_field():
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        StrategyCreate.model_validate(
            {
                "name": "Legacy Strategy",
                "strategy_type": "technical",
                "spec": _spec(),
                "indicators": [{"indicator_name": "RSI", "parameters": {"timeperiod": 14}, "usage": "entry"}],
            }
        )


def test_strategy_update_rejects_legacy_indicators_field():
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        StrategyUpdate.model_validate(
            {
                "spec": _spec(),
                "indicators": [{"indicator_name": "RSI", "parameters": {"timeperiod": 14}, "usage": "entry"}],
            }
        )


def test_serialize_strategy_excludes_legacy_indicator_rows():
    strategy = SimpleNamespace(
        id=7,
        name="RSI Mean Reversion",
        description="Buy low, sell high",
        strategy_type="technical",
        is_active=True,
        config=_spec(),
        created_at="2026-03-26T10:00:00",
        updated_at="2026-03-26T10:00:00",
    )

    response = serialize_strategy(strategy)
    payload = response.model_dump(mode="json")

    assert "indicators" not in payload
    assert payload["spec"]["indicators"][0]["indicator"] == "RSI"


def test_strategy_model_keeps_backtest_relationship():
    configure_mappers()

    assert Strategy.backtests.property.mapper.class_ is Backtest
