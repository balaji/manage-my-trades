"""
Market data models.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from app.db.session import Base


class MarketData(Base):
    """OHLCV market data cache (TimescaleDB hypertable)."""

    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)  # 1m, 5m, 15m, 1h, 1d
    timestamp = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    vwap = Column(Float, nullable=True)
    trade_count = Column(Integer, nullable=True)

    __table_args__ = (
        Index('ix_market_data_symbol_timeframe_timestamp', 'symbol', 'timeframe', 'timestamp'),
    )


class IndicatorCache(Base):
    """Cached indicator values."""

    __tablename__ = "indicator_cache"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)
    indicator_name = Column(String(100), nullable=False, index=True)
    indicator_params_hash = Column(String(64), nullable=False)  # Hash of parameters
    timestamp = Column(DateTime, nullable=False, index=True)
    value = Column(Float, nullable=False)

    __table_args__ = (
        Index('ix_indicator_cache_lookup', 'symbol', 'timeframe', 'indicator_name', 'indicator_params_hash', 'timestamp'),
    )


class PortfolioHistory(Base):
    """Portfolio equity curve history."""

    __tablename__ = "portfolio_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    equity = Column(Float, nullable=False)
    cash = Column(Float, nullable=False)
    positions_value = Column(Float, nullable=False)
    profit_loss = Column(Float, nullable=False)
    profit_loss_pct = Column(Float, nullable=False)
