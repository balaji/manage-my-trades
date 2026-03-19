"""
Signal models.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin


class Signal(Base, TimestampMixin):
    """Trading signal model."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    backtest_result_id = Column(Integer, ForeignKey("backtest_results.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)
    signal_type = Column(String(20), nullable=False)  # buy, sell, hold
    timestamp = Column(DateTime, nullable=False, index=True)
    price = Column(Float, nullable=False)
    strength = Column(Float, nullable=True)  # Signal strength 0-1
    indicators = Column(JSON, nullable=True, default=None)  # Indicator values at signal time
    metadata_ = Column("metadata", JSON, nullable=True, default=None)  # Additional signal metadata

    # Relationships
    backtest_result = relationship("BacktestResult", back_populates="signals")
