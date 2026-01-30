"""
Trade models.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin


class Trade(Base, TimestampMixin):
    """Trade model for both backtest and paper trading."""

    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(Integer, ForeignKey("backtests.id", ondelete="CASCADE"), nullable=True, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)  # buy, sell
    trade_type = Column(String(20), nullable=False)  # backtest, paper

    # Entry
    entry_date = Column(DateTime, nullable=False, index=True)
    entry_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    entry_order_id = Column(String(100), nullable=True)

    # Exit
    exit_date = Column(DateTime, nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_order_id = Column(String(100), nullable=True)

    # P&L
    pnl = Column(Float, nullable=True)
    pnl_pct = Column(Float, nullable=True)
    commission = Column(Float, default=0.0)

    # Status
    status = Column(String(20), nullable=False, default="open")  # open, closed
    notes = Column(Text, nullable=True)

    # Relationships
    backtest = relationship("Backtest", back_populates="trades")
