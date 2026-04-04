"""
Strategy models.
"""

import uuid

from sqlalchemy import Column, String, Text, Boolean, JSON, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
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
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_strategies_user_id_name"),)

    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, index=True, server_default=text("uuid_generate_v4()"))  # type: ignore[assignment]
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: str = Column(String(255), nullable=False, index=True)  # type: ignore[assignment]
    description: str = Column(Text, nullable=True)  # type: ignore[assignment]
    strategy_type: str = Column(String(50), nullable=False)  # type: ignore[assignment]  # technical, ml, combined
    is_active: bool = Column(Boolean, default=False)  # type: ignore[assignment]
    config: StrategySpec = Column(StrategySpecType, nullable=False)  # type: ignore[assignment]
    backtests = relationship("Backtest", back_populates="strategy", cascade="all, delete-orphan")
    user = relationship("User", back_populates="strategies")
