"""
Strategy models.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator
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
    backtests = relationship("Backtest", back_populates="strategy")
