"""User model."""

from sqlalchemy import Column, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class User(Base, TimestampMixin):
    """Authenticated user identified by Google subject."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, server_default=text("uuid_generate_v4()"))
    google_sub = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    picture = Column(String(512), nullable=True)

    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")
    backtests = relationship("Backtest", back_populates="user", cascade="all, delete-orphan")
