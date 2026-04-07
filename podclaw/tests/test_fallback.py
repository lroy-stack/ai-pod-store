"""
Tests for podclaw.router.fallback — CEOInactivityMonitor
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.router.fallback import (
    CEOInactivityMonitor,
    record_ceo_activity,
    CEO_LAST_MESSAGE_KEY,
    INACTIVITY_THRESHOLD,
    FALLBACK_AGENTS,
)


@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={"status": "completed"})
    return orch


@pytest.fixture()
def monitor(mock_orchestrator):
    return CEOInactivityMonitor(orchestrator=mock_orchestrator)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

class TestConstants:

    def test_threshold_is_48h(self):
        assert INACTIVITY_THRESHOLD == 48 * 3600

    def test_fallback_agents(self):
        assert FALLBACK_AGENTS == ("researcher", "qa_inspector", "finance")

    def test_redis_key(self):
        assert CEO_LAST_MESSAGE_KEY == "ceo:last_message_at"


# ---------------------------------------------------------------------------
# CEOInactivityMonitor
# ---------------------------------------------------------------------------

class TestCEOInactivityMonitor:

    @pytest.mark.asyncio
    async def test_no_redis_skips(self, monitor):
        """When Redis is unavailable, should not crash."""
        with patch("podclaw.router.fallback.get_redis", return_value=None):
            await monitor.check_and_fallback()
        # No agents should be called
        monitor._orchestrator.run_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_timestamp_skips(self, monitor):
        """When no CEO message recorded, should not trigger."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        with patch("podclaw.router.fallback.get_redis", return_value=mock_redis):
            await monitor.check_and_fallback()
        monitor._orchestrator.run_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_recent_activity_skips(self, monitor):
        """When CEO was active recently, should not trigger."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=str(time.time()))  # just now
        with patch("podclaw.router.fallback.get_redis", return_value=mock_redis):
            await monitor.check_and_fallback()
        monitor._orchestrator.run_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_inactive_triggers_agents(self, monitor):
        """When CEO inactive > 48h, should run fallback agents."""
        old_ts = str(time.time() - (49 * 3600))  # 49 hours ago
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=old_ts)
        with patch("podclaw.router.fallback.get_redis", return_value=mock_redis):
            await monitor.check_and_fallback()
        assert monitor._orchestrator.run_agent.call_count == 3
        called_agents = [call.args[0] for call in monitor._orchestrator.run_agent.call_args_list]
        assert "researcher" in called_agents
        assert "qa_inspector" in called_agents
        assert "finance" in called_agents


# ---------------------------------------------------------------------------
# record_ceo_activity
# ---------------------------------------------------------------------------

class TestRecordActivity:

    @pytest.mark.asyncio
    async def test_records_to_redis(self):
        mock_redis = AsyncMock()
        with patch("podclaw.router.fallback.get_redis", return_value=mock_redis):
            await record_ceo_activity()
        mock_redis.set.assert_called_once()
        key, value = mock_redis.set.call_args[0]
        assert key == CEO_LAST_MESSAGE_KEY
        assert float(value) > 0

    @pytest.mark.asyncio
    async def test_no_redis_doesnt_crash(self):
        with patch("podclaw.router.fallback.get_redis", return_value=None):
            await record_ceo_activity()  # should not raise
