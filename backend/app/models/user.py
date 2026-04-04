"""User model."""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class User(Base, TimestampMixin):
    """Authenticated user identified by Google subject."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    picture = Column(String(512), nullable=True)

    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")
    backtests = relationship("Backtest", back_populates="user", cascade="all, delete-orphan")
