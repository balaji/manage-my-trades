"""Tests for assets-backed symbol search in MarketDataService."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.market_data_service import MarketDataService


class FakeMappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return FakeMappingsResult(self._rows)


@pytest.mark.asyncio
async def test_search_symbols_returns_assets_rows_from_database():
    db = SimpleNamespace(
        execute=AsyncMock(
            return_value=FakeResult(
                [
                    {"symbol": "GOOG", "name": "Alphabet Inc. Class C"},
                    {"symbol": "GOOGL", "name": "Alphabet Inc. Class A"},
                ]
            )
        )
    )

    service = MarketDataService(db)

    results = await service.search_symbols("alph")

    assert results == [
        {"symbol": "GOOG", "name": "Alphabet Inc. Class C"},
        {"symbol": "GOOGL", "name": "Alphabet Inc. Class A"},
    ]


@pytest.mark.asyncio
async def test_search_symbols_builds_assets_query_with_active_filter_limit_and_ranking():
    db = SimpleNamespace(
        execute=AsyncMock(
            return_value=FakeResult(
                [
                    {"symbol": "GOOG", "name": "Alphabet Inc. Class C"},
                ]
            )
        )
    )

    service = MarketDataService(db)

    await service.search_symbols("goog")

    statement = db.execute.await_args.args[0]
    sql = str(statement)

    assert "FROM assets" in sql
    assert "assets.status IS true" in sql
    assert "CASE" in sql
    assert "LIMIT" in sql
    assert statement._limit_clause.value == 10
