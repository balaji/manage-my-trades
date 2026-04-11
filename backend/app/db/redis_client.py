"""Redis client for caching."""

import json
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.config import get_settings

_redis_client: Redis | None = None


async def connect_redis() -> None:
    """Initialize the Redis connection pool."""
    global _redis_client
    settings = get_settings()
    _redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


def get_redis() -> Redis | None:
    """Return the Redis client, or None if not connected."""
    return _redis_client


def regime_cache_key(symbol: str, timeframe: str, n_regimes: int, regime_type: str) -> str:
    return f"regime:{symbol}:{timeframe}:{n_regimes}:{regime_type}"


def indicator_cache_key(symbol: str, timeframe: str, name: str, params: dict) -> str:
    sorted_params = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return f"indicator:{symbol}:{timeframe}:{name.upper()}:{sorted_params}"


def seconds_until_midnight_utc() -> int:
    """Return seconds remaining until 00:00 UTC."""
    now = datetime.now(timezone.utc)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((midnight - now).total_seconds())
