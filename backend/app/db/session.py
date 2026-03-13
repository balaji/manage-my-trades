"""
Database session management.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import get_settings

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.TRADING_DATA_DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Create declarative base
Base = declarative_base()

# --- Market Data DB ---

market_data_engine = create_async_engine(
    settings.MARKET_DATA_DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

MarketDataSessionLocal = async_sessionmaker(
    market_data_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

MarketDataBase = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session.

    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_market_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get market data database session.

    Yields:
        AsyncSession: Market data database session
    """
    async with MarketDataSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize trading_db tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def init_market_db():
    """Initialize market_data_db tables."""
    async with market_data_engine.begin() as conn:
        await conn.run_sync(MarketDataBase.metadata.create_all)
