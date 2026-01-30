"""
Strategy models.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin


class Strategy(Base, TimestampMixin):
    """Strategy model."""

    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    strategy_type = Column(String(50), nullable=False)  # technical, ml, combined
    is_active = Column(Boolean, default=False)
    config = Column(JSON, nullable=False, default={})  # Strategy-specific configuration

    # Relationships
    indicators = relationship("StrategyIndicator", back_populates="strategy", cascade="all, delete-orphan")
    backtests = relationship("Backtest", back_populates="strategy")
    signals = relationship("Signal", back_populates="strategy")


class StrategyIndicator(Base, TimestampMixin):
    """Indicator configuration for a strategy."""

    __tablename__ = "strategy_indicators"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False)
    indicator_name = Column(String(100), nullable=False)  # sma, ema, rsi, macd, etc.
    parameters = Column(JSON, nullable=False, default={})  # Indicator-specific parameters
    usage = Column(String(50), nullable=False)  # entry, exit, filter

    # Relationships
    strategy = relationship("Strategy", back_populates="indicators")
