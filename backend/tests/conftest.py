import os

os.environ.setdefault("TRADE_DATA_DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("MARKET_DATA_DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test_market")

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def ohlcv_df():
    """100 days of synthetic OHLCV data with a slight uptrend."""
    n = 100
    dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)]
    close = 100 + np.cumsum(np.random.default_rng(42).normal(0.1, 1, n))
    return pd.DataFrame(
        {
            "timestamp": dates,
            "open": close * 0.999,
            "high": close * 1.005,
            "low": close * 0.995,
            "close": close,
            "volume": np.full(n, 1_000_000),
        }
    )


@pytest.fixture
def falling_ohlcv_df():
    """Sharp downtrend — produces oversold RSI."""
    n = 50
    dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)]
    close = 200 - np.arange(n) * 2.0
    return pd.DataFrame(
        {
            "timestamp": dates,
            "open": close * 1.001,
            "high": close * 1.005,
            "low": close * 0.995,
            "close": close,
            "volume": np.full(n, 1_000_000),
        }
    )


@pytest.fixture
def rising_ohlcv_df():
    """Sharp uptrend — produces overbought RSI."""
    n = 50
    dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)]
    close = 100 + np.arange(n) * 2.0
    return pd.DataFrame(
        {
            "timestamp": dates,
            "open": close * 0.999,
            "high": close * 1.005,
            "low": close * 0.995,
            "close": close,
            "volume": np.full(n, 1_000_000),
        }
    )
