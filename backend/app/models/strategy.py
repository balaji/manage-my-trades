"""
Strategy models.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin
from app.core.strategies.spec import StrategySpec


class StrategySpecType(TypeDecorator):
    """SQLAlchemy type that stores StrategySpec as JSON and deserializes on load."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, StrategySpec):
            return value.model_dump(mode="json")
        return value  # already a dict

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return StrategySpec.model_validate(value)


class Strategy(Base, TimestampMixin):
    """Strategy model."""

    __tablename__ = "strategies"

    id: int = Column(Integer, primary_key=True, index=True)  # type: ignore[assignment]
    name: str = Column(String(255), nullable=False, unique=True, index=True)  # type: ignore[assignment]
    description: str = Column(Text, nullable=True)  # type: ignore[assignment]
    strategy_type: str = Column(String(50), nullable=False)  # type: ignore[assignment]  # technical, ml, combined
    is_active: bool = Column(Boolean, default=False)  # type: ignore[assignment]
    config: StrategySpec = Column(StrategySpecType, nullable=False)  # type: ignore[assignment]

    # Relationships
    indicators = relationship("StrategyIndicator", back_populates="strategy", cascade="all, delete-orphan")
    backtests = relationship("Backtest", back_populates="strategy")


class StrategyIndicator(Base, TimestampMixin):
    """Indicator configuration for a strategy."""

    __tablename__ = "strategy_indicators"

    id: int = Column(Integer, primary_key=True, index=True)  # type: ignore[assignment]
    strategy_id: int = Column(Integer, ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False)  # type: ignore[assignment]
    indicator_name: str = Column(String(100), nullable=False)  # type: ignore[assignment]  # sma, ema, rsi, macd, etc.
    parameters: dict = Column(JSON, nullable=False, default={})  # type: ignore[assignment]  # Indicator-specific parameters
    usage: str = Column(String(50), nullable=False)  # type: ignore[assignment]  # entry, exit, filter

    # Relationships
    strategy = relationship("Strategy", back_populates="indicators")
