"""
Backtest models.
"""

from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin


class Backtest(Base, TimestampMixin):
    """Backtest model."""

    __tablename__ = "backtests"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    symbols = Column(JSON, nullable=False)  # List of symbols
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    initial_capital = Column(Float, nullable=False)
    timeframe = Column(String(10), nullable=False, default="1d")  # 1m, 5m, 15m, 1h, 1d
    commission = Column(Float, default=0.0)
    slippage = Column(Float, default=0.001)
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)

    # Relationships
    strategy = relationship("Strategy", back_populates="backtests")
    results = relationship(
        "BacktestResult",
        back_populates="backtest",
        uselist=False,
        cascade="all, delete-orphan",
    )
    trades = relationship("Trade", back_populates="backtest", cascade="all, delete-orphan")


class BacktestResult(Base, TimestampMixin):
    """Backtest performance results."""

    __tablename__ = "backtest_results"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(
        Integer,
        ForeignKey("backtests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Performance metrics
    total_return = Column(Float, nullable=False)
    total_return_pct = Column(Float, nullable=False)
    sharpe_ratio = Column(Float, nullable=True)
    max_drawdown = Column(Float, nullable=False)
    max_drawdown_pct = Column(Float, nullable=False)
    win_rate = Column(Float, nullable=False)
    profit_factor = Column(Float, nullable=True)
    total_trades = Column(Integer, nullable=False)
    winning_trades = Column(Integer, nullable=False)
    losing_trades = Column(Integer, nullable=False)
    avg_win = Column(Float, nullable=True)
    avg_loss = Column(Float, nullable=True)
    avg_trade_duration = Column(Float, nullable=True)  # in hours
    final_capital = Column(Float, nullable=False)

    # Equity curve data (timestamps and values)
    equity_curve = Column(JSON, nullable=False, default={})

    # Relationships
    backtest = relationship("Backtest", back_populates="results")
