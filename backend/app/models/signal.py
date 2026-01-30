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
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)
    signal_type = Column(String(20), nullable=False)  # buy, sell, hold
    timestamp = Column(DateTime, nullable=False, index=True)
    price = Column(Float, nullable=False)
    strength = Column(Float, nullable=True)  # Signal strength 0-1
    indicators = Column(JSON, nullable=True, default={})  # Indicator values at signal time
    metadata = Column(JSON, nullable=True, default={})  # Additional signal metadata

    # Relationships
    strategy = relationship("Strategy", back_populates="signals")
