"""Tests for Redis indicator caching in TechnicalAnalysisService."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.redis_client import indicator_cache_key
from app.services.technical_analysis_service import TechnicalAnalysisService


_FAKE_SMA = {
    "name": "SMA",
    "params": {"timeperiod": 20},
    "outputs": {"real": [{"timestamp": "2024-01-02T00:00:00", "value": 450.0}]},
}
_FAKE_RSI = {
    "name": "RSI",
    "params": {"timeperiod": 14},
    "outputs": {"real": [{"timestamp": "2024-01-02T00:00:00", "value": 55.0}]},
}


class TestIndicatorCacheKey:
    def test_format(self):
        key = indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 20})
        assert key == 'indicator:SPY:1d:SMA:{"timeperiod":20}'

    def test_name_is_uppercased(self):
        assert indicator_cache_key("SPY", "1d", "sma", {}) == indicator_cache_key("SPY", "1d", "SMA", {})

    def test_params_sorted_for_determinism(self):
        k1 = indicator_cache_key("SPY", "1d", "MACD", {"slowperiod": 26, "fastperiod": 12})
        k2 = indicator_cache_key("SPY", "1d", "MACD", {"fastperiod": 12, "slowperiod": 26})
        assert k1 == k2

    def test_uniqueness_across_params(self):
        k1 = indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 20})
        k2 = indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 50})
        k3 = indicator_cache_key("QQQ", "1d", "SMA", {"timeperiod": 20})
        k4 = indicator_cache_key("SPY", "1h", "SMA", {"timeperiod": 20})
        k5 = indicator_cache_key("SPY", "1d", "EMA", {"timeperiod": 20})
        assert len({k1, k2, k3, k4, k5}) == 5

    def test_empty_params(self):
        key = indicator_cache_key("SPY", "1d", "SMA", {})
        assert key == "indicator:SPY:1d:SMA:{}"


class TestCalculateIndicatorsCaching:
    _request = [{"name": "SMA", "params": {"timeperiod": 20}}]

    @pytest.mark.asyncio
    async def test_cache_miss_calls_compute_and_stores(self):
        """On cache miss, indicators are computed and stored in Redis."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_SMA])):
            result = await service.calculate_indicators("SPY", "1d", self._request)

        expected_key = indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 20})
        mock_redis.get.assert_awaited_once_with(expected_key)
        mock_redis.setex.assert_awaited_once()
        assert result["symbol"] == "SPY"
        assert len(result["indicators"]) == 1
        assert result["indicators"][0]["name"] == "SMA"

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_without_recompute(self):
        """On cache hit, returns cached value and skips computation."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = json.dumps(_FAKE_SMA)

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_indicators", new=AsyncMock()) as mock_compute:
            result = await service.calculate_indicators("SPY", "1d", self._request)
            mock_compute.assert_not_awaited()

        assert result["indicators"][0] == _FAKE_SMA

    @pytest.mark.asyncio
    async def test_partial_cache_hit_computes_only_missing(self):
        """When some indicators are cached and others are not, only missing ones are computed."""
        mock_redis = AsyncMock()

        _sma_key = indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 20})

        async def fake_get(key):
            if key == _sma_key:
                return json.dumps(_FAKE_SMA)
            return None

        mock_redis.get.side_effect = fake_get

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        two_indicators = [
            {"name": "SMA", "params": {"timeperiod": 20}},
            {"name": "RSI", "params": {"timeperiod": 14}},
        ]

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_RSI])) as mock_compute:
            result = await service.calculate_indicators("SPY", "1d", two_indicators)

        called_indicators = mock_compute.call_args.args[2]
        assert len(called_indicators) == 1
        assert called_indicators[0]["name"] == "RSI"
        assert len(result["indicators"]) == 2

    @pytest.mark.asyncio
    async def test_no_redis_falls_back_to_direct_compute(self):
        """Without a Redis client, compute runs directly without caching."""
        service = TechnicalAnalysisService(MagicMock(), redis_client=None)

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_SMA])):
            result = await service.calculate_indicators("SPY", "1d", self._request)

        assert result["indicators"][0] == _FAKE_SMA

    @pytest.mark.asyncio
    async def test_setex_called_with_correct_key_and_positive_ttl(self):
        """setex uses the expected cache key and a positive TTL."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_SMA])):
            await service.calculate_indicators("SPY", "1d", self._request)

        call_args = mock_redis.setex.call_args
        key, ttl, _ = call_args.args
        assert key == indicator_cache_key("SPY", "1d", "SMA", {"timeperiod": 20})
        assert 0 < ttl <= 86400

    @pytest.mark.asyncio
    async def test_redis_read_failure_falls_back_to_compute(self):
        """If Redis read raises, computation proceeds without raising."""
        mock_redis = AsyncMock()
        mock_redis.get.side_effect = Exception("Redis unavailable")

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_SMA])) as mock_compute:
            result = await service.calculate_indicators("SPY", "1d", self._request)
            mock_compute.assert_awaited_once()

        assert result["indicators"][0] == _FAKE_SMA

    @pytest.mark.asyncio
    async def test_redis_write_failure_still_returns_result(self):
        """If Redis write raises, the result is still returned to the caller."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex.side_effect = Exception("Redis write failed")

        service = TechnicalAnalysisService(MagicMock(), redis_client=mock_redis)

        with patch.object(service, "_compute_indicators", new=AsyncMock(return_value=[_FAKE_SMA])):
            result = await service.calculate_indicators("SPY", "1d", self._request)

        assert result["indicators"][0] == _FAKE_SMA
