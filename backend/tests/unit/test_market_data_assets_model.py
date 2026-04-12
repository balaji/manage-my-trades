"""Unit tests for market-data asset metadata models."""

from app.models.market_data import Asset


def test_assets_table_tracks_symbol_metadata():
    table = Asset.__table__

    assert table.name == "assets"
    assert set(table.columns.keys()) == {"id", "symbol", "name", "status", "exchange"}
    assert table.c.id.primary_key is True
    assert table.c.symbol.nullable is False
    assert table.c.name.nullable is False
    assert table.c.status.nullable is False
    assert table.c.exchange.nullable is False

    unique_constraints = {constraint.name for constraint in table.constraints if getattr(constraint, "name", None)}
    assert "uq_assets_symbol" in unique_constraints
