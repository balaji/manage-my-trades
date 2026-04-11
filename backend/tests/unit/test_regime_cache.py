"""Tests for Redis regime caching in TechnicalAnalysisService."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.redis_client import regime_cache_key, seconds_until_midnight_utc
from app.services.technical_analysis_service import TechnicalAnalysisService


class TestRegimeCacheKey:
    def test_format(self):
        assert regime_cache_key("SPY", "1d", 3, "directional") == "regime:SPY:1d:3:directional"

    def test_uniqueness_across_params(self):
        k1 = regime_cache_key("SPY", "1d", 3, "directional")
        k2 = regime_cache_key("SPY", "1d", 2, "directional")
        k3 = regime_cache_key("QQQ", "1d", 3, "directional")
        k4 = regime_cache_key("SPY", "1h", 3, "directional")
        k5 = regime_cache_key("SPY", "1d", 3, "volatility")
        assert len({k1, k2, k3, k4, k5}) == 5


class TestSecondsUntilMidnightUtc:
    def test_ttl_is_positive(self):
        assert seconds_until_midnight_utc() > 0

    def test_ttl_does_not_exceed_one_day(self):
        assert seconds_until_midnight_utc() <= 86400


class TestRegimeCaching:
    _fake_segments = [{"start": "2024-01-01T00:00:00", "end": "2024-06-01T00:00:00", "regime": "bullish"}]
    _fake_result = {"symbol": "SPY", "timeframe": "1d", "segments": _fake_segments}

    @pytest.mark.asyncio
    async def test_cache_miss_calls_compute_and_stores(self):
        """On cache miss, detection runs and result is stored in Redis."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_regimes", new=AsyncMock(return_value=self._fake_result)):
            result = await service.detect_regimes("SPY", "1d", 3, "directional")

        mock_redis.get.assert_awaited_once_with("regime:SPY:1d:3:directional")
        mock_redis.setex.assert_awaited_once()
        assert result["symbol"] == "SPY"
        assert result["segments"] == self._fake_segments

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_without_recompute(self):
        """On cache hit, returns cached value and skips regime detection."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = json.dumps(self._fake_result)

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_regimes", new=AsyncMock()) as mock_compute:
            result = await service.detect_regimes("SPY", "1d", 3, "directional")
            mock_compute.assert_not_awaited()

        assert result == self._fake_result

    @pytest.mark.asyncio
    async def test_cache_miss_setex_uses_correct_key_and_positive_ttl(self):
        """setex is called with the expected cache key and a positive TTL."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_regimes", new=AsyncMock(return_value=self._fake_result)):
            await service.detect_regimes("SPY", "1d", 3, "directional")

        call_args = mock_redis.setex.call_args
        key, ttl, _ = call_args.args
        assert key == "regime:SPY:1d:3:directional"
        assert 0 < ttl <= 86400

    @pytest.mark.asyncio
    async def test_no_redis_client_falls_back_to_direct_compute(self):
        """Without a Redis client, detect_regimes computes directly."""
        service = TechnicalAnalysisService(MagicMock(), redis_client=None)

        with patch.object(service, "_compute_regimes", new=AsyncMock(return_value=self._fake_result)):
            result = await service.detect_regimes("SPY", "1d", 3, "directional")

        assert result == self._fake_result
