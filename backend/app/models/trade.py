"""
Trade models.
"""

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Trade(Base, TimestampMixin):
    """Trade model for both backtest and paper trading."""

    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(
        Integer,
        ForeignKey("backtests.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
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
    exit_price = Column(Float, nullable=True, default=0.0)
    exit_order_id = Column(String(100), nullable=True)

    # P&L
    pnl = Column(Float, nullable=True, default=0.0)
    pnl_pct = Column(Float, nullable=True)
    commission = Column(Float, default=0.0)

    # Status
    status = Column(String(20), nullable=False, default="open")  # open, closed
    notes = Column(Text, nullable=True)

    # Relationships
    backtest = relationship("Backtest", back_populates="trades")

    def __repr__(self):
        return f"<Trade id={self.id} symbol={self.symbol} side={self.side} quantity={self.quantity} entry_price={self.entry_price} exit_price={self.exit_price} pnl={self.pnl} pnl_pct={self.pnl_pct} status={self.status} entry_date={self.entry_date} exit_date={self.exit_date} strategy_id={self.strategy_id} trade_type={self.trade_type} backtest_id={self.backtest_id} created_at={self.created_at} updated_at={self.updated_at} notes={self.notes}>"
