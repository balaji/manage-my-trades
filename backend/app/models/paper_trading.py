"""
Paper trading models.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from app.db.session import Base
from app.models.base import TimestampMixin


class Position(Base, TimestampMixin):
    """Current paper trading position."""

    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    quantity = Column(Float, nullable=False)
    avg_entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    market_value = Column(Float, nullable=True)
    unrealized_pnl = Column(Float, nullable=True)
    unrealized_pnl_pct = Column(Float, nullable=True)
    cost_basis = Column(Float, nullable=False)
    side = Column(String(10), nullable=False)  # long, short


class Order(Base, TimestampMixin):
    """Paper trading order."""

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    alpaca_order_id = Column(String(100), unique=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    side = Column(String(10), nullable=False)  # buy, sell
    order_type = Column(String(20), nullable=False)  # market, limit, stop, stop_limit
    time_in_force = Column(String(10), nullable=False)  # day, gtc, ioc, fok
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    filled_qty = Column(Float, default=0.0)
    filled_avg_price = Column(Float, nullable=True)
    status = Column(String(20), nullable=False)  # pending, new, filled, partially_filled, canceled, rejected
    submitted_at = Column(DateTime, nullable=False)
    filled_at = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True, default={})
    error_message = Column(Text, nullable=True)
