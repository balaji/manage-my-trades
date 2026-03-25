"""
Unit tests for PortfolioService.

Pure logic tests — no DB, no network, no async.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.portfolio import Portfolio, PortfolioMetrics, PortfolioPosition, PortfolioSnapshot
from app.schemas.portfolio import PortfolioCreate, PortfolioPositionCreate, PortfolioUpdate
from app.services.portfolio_service import PortfolioService


def _make_portfolio(
    id: int = 1,
    name: str = "Test Portfolio",
    initial_capital: float = 10000.0,
    current_cash: float = 10000.0,
    portfolio_type: str = "paper",
    is_active: bool = True,
) -> Portfolio:
    p = MagicMock(spec=Portfolio)
    p.id = id
    p.name = name
    p.initial_capital = initial_capital
    p.current_cash = current_cash
    p.portfolio_type = portfolio_type
    p.is_active = is_active
    p.currency = "USD"
    p.positions = []
    p.snapshots = []
    p.metrics = None
    return p


def _make_position(symbol: str, quantity: float, avg_entry_price: float, current_price: float) -> PortfolioPosition:
    pos = MagicMock(spec=PortfolioPosition)
    pos.symbol = symbol
    pos.quantity = quantity
    pos.avg_entry_price = avg_entry_price
    pos.current_price = current_price
    pos.cost_basis = quantity * avg_entry_price
    pos.market_value = quantity * current_price
    pos.unrealized_pnl = (current_price - avg_entry_price) * quantity
    pos.unrealized_pnl_pct = (current_price - avg_entry_price) / avg_entry_price * 100
    pos.side = "long"
    pos.weight = None
    return pos


class TestPortfolioCreate:
    """Tests for portfolio creation logic."""

    @pytest.mark.asyncio
    async def test_create_sets_current_cash_equal_to_initial_capital(self):
        """Newly created portfolio cash must equal initial_capital."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        captured = {}

        def capture_add(obj):
            if isinstance(obj, Portfolio):
                captured["portfolio"] = obj

        db.add = MagicMock(side_effect=capture_add)

        service = PortfolioService(db)
        data = PortfolioCreate(name="My Portfolio", initial_capital=5000.0)

        with patch.object(service, "get_portfolio", return_value=_make_portfolio(current_cash=5000.0)):
            await service.create_portfolio(data)

        portfolio = captured.get("portfolio")
        assert portfolio is not None
        assert portfolio.current_cash == 5000.0
        assert portfolio.initial_capital == 5000.0

    @pytest.mark.asyncio
    async def test_create_raises_on_duplicate_name(self):
        """Creating a portfolio with an existing name raises ValueError."""
        db = AsyncMock()
        existing = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing)))

        service = PortfolioService(db)
        data = PortfolioCreate(name="Existing", initial_capital=1000.0)

        with pytest.raises(ValueError, match="already exists"):
            await service.create_portfolio(data)


class TestPortfolioUpdate:
    """Tests for portfolio update logic."""

    @pytest.mark.asyncio
    async def test_update_returns_none_for_missing_portfolio(self):
        """Updating a non-existent portfolio returns None."""
        db = AsyncMock()
        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=None):
            result = await service.update_portfolio(999, PortfolioUpdate(name="New Name"))

        assert result is None

    @pytest.mark.asyncio
    async def test_update_is_active_flag(self):
        """Updating is_active persists the new value."""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        portfolio = _make_portfolio(is_active=True)
        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", side_effect=[portfolio, portfolio]):
            await service.update_portfolio(1, PortfolioUpdate(is_active=False))

        assert portfolio.is_active is False


class TestUpsertPosition:
    """Tests for adding/updating positions within a portfolio."""

    @pytest.mark.asyncio
    async def test_upsert_creates_new_position(self):
        """When the symbol doesn't exist in the portfolio a new position is created."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        captured = {}
        db.add = MagicMock(side_effect=lambda obj: captured.update({"pos": obj}))

        service = PortfolioService(db)
        data = PortfolioPositionCreate(symbol="AAPL", quantity=10, avg_entry_price=150.0, cost_basis=1500.0)

        await service.upsert_position(portfolio_id=1, data=data)

        pos = captured.get("pos")
        assert pos is not None
        assert pos.symbol == "AAPL"
        assert pos.quantity == 10
        assert pos.avg_entry_price == 150.0

    @pytest.mark.asyncio
    async def test_upsert_updates_existing_position(self):
        """When the symbol already exists, quantity and price are updated."""
        existing_pos = MagicMock(spec=PortfolioPosition)
        existing_pos.symbol = "SPY"
        existing_pos.quantity = 5
        existing_pos.avg_entry_price = 400.0

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing_pos)))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        service = PortfolioService(db)
        data = PortfolioPositionCreate(symbol="SPY", quantity=15, avg_entry_price=410.0, cost_basis=6150.0)

        await service.upsert_position(portfolio_id=1, data=data)

        assert existing_pos.quantity == 15
        assert existing_pos.avg_entry_price == 410.0
        assert existing_pos.cost_basis == 6150.0


class TestRecordSnapshot:
    """Tests for snapshot recording."""

    @pytest.mark.asyncio
    async def test_snapshot_equity_equals_cash_plus_positions_value(self):
        """Recorded snapshot equity must equal cash + sum of position market values."""
        pos1 = _make_position("AAPL", 10, 150.0, 160.0)  # market_value = 1600
        pos2 = _make_position("SPY", 5, 400.0, 420.0)  # market_value = 2100

        portfolio = _make_portfolio(current_cash=5000.0)
        portfolio.positions = [pos1, pos2]

        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        captured = {}
        db.add = MagicMock(side_effect=lambda obj: captured.update({"snap": obj}))

        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=portfolio):
            await service.record_snapshot(portfolio_id=1)

        snap = captured.get("snap")
        assert snap is not None
        expected_positions_value = 1600.0 + 2100.0
        assert snap.positions_value == pytest.approx(expected_positions_value)
        assert snap.equity == pytest.approx(5000.0 + expected_positions_value)
        assert snap.cash == pytest.approx(5000.0)

    @pytest.mark.asyncio
    async def test_snapshot_raises_for_missing_portfolio(self):
        """Recording a snapshot for a non-existent portfolio raises ValueError."""
        db = AsyncMock()
        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=None):
            with pytest.raises(ValueError, match="not found"):
                await service.record_snapshot(portfolio_id=999)


class TestCalculateMetrics:
    """Tests for portfolio metrics calculation."""

    @pytest.mark.asyncio
    async def test_metrics_raises_for_missing_portfolio(self):
        """Calculating metrics for a non-existent portfolio raises ValueError."""
        db = AsyncMock()
        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=None):
            with pytest.raises(ValueError, match="not found"):
                await service.calculate_metrics(portfolio_id=999)

    @pytest.mark.asyncio
    async def test_metrics_returns_none_values_with_no_snapshots(self):
        """With no equity history, all computed metrics should be None."""
        portfolio = _make_portfolio(initial_capital=10000.0)
        portfolio.snapshots = []

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        captured = {}
        db.add = MagicMock(side_effect=lambda obj: captured.update({"metrics": obj}))

        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=portfolio):
            await service.calculate_metrics(portfolio_id=1)

        m = captured.get("metrics")
        assert m is not None
        assert m.sharpe_ratio is None
        assert m.max_drawdown is None
        assert m.total_return is None

    @pytest.mark.asyncio
    async def test_metrics_total_return_computed_from_snapshots(self):
        """total_return should equal final_equity - initial_capital."""
        portfolio = _make_portfolio(initial_capital=10000.0)

        snap1 = MagicMock(spec=PortfolioSnapshot)
        snap1.equity = 10000.0
        snap2 = MagicMock(spec=PortfolioSnapshot)
        snap2.equity = 11500.0
        portfolio.snapshots = [snap1, snap2]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        captured = {}
        db.add = MagicMock(side_effect=lambda obj: captured.update({"metrics": obj}))

        service = PortfolioService(db)

        with patch.object(service, "get_portfolio", return_value=portfolio):
            await service.calculate_metrics(portfolio_id=1)

        m = captured.get("metrics")
        assert m is not None
        assert m.total_return == pytest.approx(1500.0)
        assert m.total_return_pct == pytest.approx(15.0)
