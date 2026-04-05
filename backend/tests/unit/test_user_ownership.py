import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from datetime import date

import pytest

from app.models import User
from app.schemas.strategy import StrategyCreate
from app.services.strategy_service import StrategyService
from app.services.backtest_service import BacktestService
from app.services.user_service import UserService

USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class FakeResult:
    def __init__(self, value=None, rows=None):
        self.value = value
        self.rows = rows or []

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.rows


def _spec():
    return {
        "kind": "technical",
        "metadata": {"name": "Owned Strategy"},
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
    }


@pytest.mark.asyncio
async def test_user_service_creates_google_user_when_missing():
    db = SimpleNamespace(execute=AsyncMock(return_value=FakeResult(None)), add=MagicMock(), flush=AsyncMock())
    service = UserService(db)

    user = await service.get_or_create_google_user("google-sub-123")

    assert user.google_sub == "google-sub-123"
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_user_service_flushes_when_updating_existing_user():
    existing_user = User(id=USER_ID, google_sub="sub-a", name="Old Name", picture="old.png")
    db = SimpleNamespace(
        execute=AsyncMock(return_value=FakeResult(existing_user)),
        flush=AsyncMock(),
    )
    service = UserService(db)

    returned = await service.get_or_create_google_user("sub-a", name="New Name", picture="new.png")

    assert returned.name == "New Name"
    assert returned.picture == "new.png"
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_strategy_names_are_scoped_per_user():
    user = User(id=USER_ID, google_sub="sub-a")
    existing_strategy = SimpleNamespace()
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[FakeResult(None), FakeResult(existing_strategy)]),
        add=MagicMock(),
        flush=AsyncMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    service = StrategyService(db)
    strategy_data = StrategyCreate.model_validate({"name": "Same Name", "spec": _spec()})

    created = await service.create_strategy(strategy_data, user)

    assert created.name == "Same Name"
    assert created.user_id == USER_ID
    assert db.add.call_count == 1


@pytest.mark.asyncio
async def test_backtest_creation_uses_current_user_strategy_only():
    user = User(id=USER_ID, google_sub="sub-a")
    strategy = SimpleNamespace(id=11)
    db = SimpleNamespace(
        add=MagicMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        execute=AsyncMock(return_value=FakeResult(SimpleNamespace(strategy_id=11, user_id=USER_ID))),
    )
    market_db = SimpleNamespace()
    service = BacktestService(db, market_db)
    service.strategy_service.get_strategy = AsyncMock(return_value=strategy)
    payload = SimpleNamespace(
        strategy_id=11,
        name="bt",
        symbols=["SPY"],
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 1),
        initial_capital=10000.0,
        timeframe="1d",
        commission=0.0,
        slippage=0.001,
    )

    backtest = await service.create_backtest(payload, user)

    assert backtest.user_id == USER_ID
    assert db.add.call_args.args[0].user_id == USER_ID


@pytest.mark.asyncio
async def test_user_service_deletes_current_user():
    user = User(id=USER_ID, google_sub="sub-a")
    db = SimpleNamespace(
        delete=AsyncMock(),
        commit=AsyncMock(),
    )
    service = UserService(db)

    await service.delete_user(user)

    db.delete.assert_awaited_once_with(user)
    db.commit.assert_awaited_once()
