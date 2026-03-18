"""
Unit tests for MetricsCalculator.

Pure math tests — no DB, no network, no async.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock

from app.core.backtesting.metrics import MetricsCalculator
from app.models.trade import Trade


class TestProfitFactor:
    """Test profit_factor calculation."""

    def _create_trade(self, pnl: float, status: str = "closed") -> Trade:
        """Helper to create a mock Trade object."""
        trade = MagicMock(spec=Trade)
        trade.pnl = pnl
        trade.status = status
        return trade

    def test_profit_factor_no_trades_returns_none(self):
        """Empty trades list should return None."""
        result = MetricsCalculator.calculate_profit_factor([])
        assert result is None

    def test_profit_factor_no_closed_trades_returns_none(self):
        """Only open trades should return None."""
        trades = [self._create_trade(pnl=100.0, status="open")]
        result = MetricsCalculator.calculate_profit_factor(trades)
        assert result is None

    def test_profit_factor_all_winners_returns_none(self):
        """All winning trades (no losers) should return None, not infinity."""
        trades = [
            self._create_trade(pnl=100.0),
            self._create_trade(pnl=50.0),
            self._create_trade(pnl=25.0),
        ]
        result = MetricsCalculator.calculate_profit_factor(trades)
        assert result is None

    def test_profit_factor_mixed_trades(self):
        """Mixed wins and losses should calculate correctly."""
        trades = [
            self._create_trade(pnl=100.0),  # win
            self._create_trade(pnl=-50.0),  # loss
            self._create_trade(pnl=200.0),  # win
            self._create_trade(pnl=-25.0),  # loss
        ]
        result = MetricsCalculator.calculate_profit_factor(trades)
        # gross_profit = 100 + 200 = 300
        # gross_loss = abs(-50 + -25) = 75
        # profit_factor = 300 / 75 = 4.0
        assert result == 4.0

    def test_profit_factor_only_losers_returns_zero(self):
        """Only losing trades should return 0 (no profit)."""
        trades = [
            self._create_trade(pnl=-100.0),
            self._create_trade(pnl=-50.0),
        ]
        result = MetricsCalculator.calculate_profit_factor(trades)
        # gross_profit = 0, gross_loss = 150, profit_factor = 0 / 150 = 0
        assert result == 0.0

    def test_profit_factor_break_even_returns_none(self):
        """Break-even trades (no wins, no losses) should return None."""
        trades = [
            self._create_trade(pnl=0.0),
            self._create_trade(pnl=0.0),
        ]
        result = MetricsCalculator.calculate_profit_factor(trades)
        assert result is None
