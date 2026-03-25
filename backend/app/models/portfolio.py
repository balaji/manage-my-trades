"""
Portfolio management models.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Portfolio(Base, TimestampMixin):
    """A named portfolio that groups positions and tracks performance."""

    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    portfolio_type = Column(String(20), nullable=False, default="paper")  # paper, live, backtest
    initial_capital = Column(Float, nullable=False)
    current_cash = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    is_active = Column(Boolean, nullable=False, default=True)

    positions = relationship("PortfolioPosition", back_populates="portfolio", cascade="all, delete-orphan")
    snapshots = relationship("PortfolioSnapshot", back_populates="portfolio", cascade="all, delete-orphan")
    metrics = relationship("PortfolioMetrics", back_populates="portfolio", uselist=False, cascade="all, delete-orphan")


class PortfolioPosition(Base, TimestampMixin):
    """A symbol holding within a portfolio. One row per (portfolio, symbol)."""

    __tablename__ = "portfolio_positions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    avg_entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    market_value = Column(Float, nullable=True)
    cost_basis = Column(Float, nullable=False)
    unrealized_pnl = Column(Float, nullable=True)
    unrealized_pnl_pct = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)  # percentage of total portfolio value
    side = Column(String(10), nullable=False, default="long")  # long, short

    __table_args__ = (
        UniqueConstraint("portfolio_id", "symbol", name="uq_portfolio_position_symbol"),
        Index("ix_portfolio_positions_portfolio_symbol", "portfolio_id", "symbol"),
    )

    portfolio = relationship("Portfolio", back_populates="positions")


class PortfolioSnapshot(Base, TimestampMixin):
    """Point-in-time equity snapshot for a portfolio (equity curve)."""

    __tablename__ = "portfolio_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    equity = Column(Float, nullable=False)  # cash + positions_value
    cash = Column(Float, nullable=False)
    positions_value = Column(Float, nullable=False)
    daily_pnl = Column(Float, nullable=True)
    daily_pnl_pct = Column(Float, nullable=True)
    total_return = Column(Float, nullable=True)
    total_return_pct = Column(Float, nullable=True)
    positions_count = Column(Integer, nullable=True)

    portfolio = relationship("Portfolio", back_populates="snapshots")


class PortfolioMetrics(Base, TimestampMixin):
    """Computed aggregate performance metrics for a portfolio (1:1 with Portfolio)."""

    __tablename__ = "portfolio_metrics"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_return = Column(Float, nullable=True)
    total_return_pct = Column(Float, nullable=True)
    sharpe_ratio = Column(Float, nullable=True)
    sortino_ratio = Column(Float, nullable=True)
    max_drawdown = Column(Float, nullable=True)
    max_drawdown_pct = Column(Float, nullable=True)
    win_rate = Column(Float, nullable=True)
    profit_factor = Column(Float, nullable=True)
    volatility = Column(Float, nullable=True)
    total_trades = Column(Integer, nullable=True)
    calculated_at = Column(DateTime, nullable=True)

    portfolio = relationship("Portfolio", back_populates="metrics")
