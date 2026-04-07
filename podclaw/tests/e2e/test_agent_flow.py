"""
E2E Tests — Full Agent Flow

Tests the complete pipeline: Orchestrator → ClientFactory (mocked SDK) → Hooks → EventStore.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.core import Orchestrator, AGENT_NAMES
from podclaw.event_store import EventStore
from podclaw.hooks.metrics_hook import get_agent_metrics, reset_metrics
from podclaw.hooks.rate_limit_hook import reset_counters, get_counters
from podclaw.hooks.cost_guard_hook import get_daily_costs, reset_costs


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_sdk_client():
    """Mock Claude SDK client that simulates a successful agent run."""
    client = AsyncMock()
    client.connect = AsyncMock()
    client.disconnect = AsyncMock()
    client.query = AsyncMock()

    from claude_agent_sdk import ResultMessage

    result_msg = MagicMock(spec=ResultMessage)
    result_msg.num_turns = 5
    result_msg.total_cost_usd = 0.08
    result_msg.session_id = "sdk-e2e-sess"
    result_msg.usage = {"input_tokens": 200, "output_tokens": 100}

    text_block = MagicMock()
    text_block.content = [MagicMock()]
    type(text_block.content[0]).__name__ = "TextBlock"
    text_block.content[0].text = "Research completed successfully."

    async def _fake_receive():
        yield text_block
        yield result_msg

    client.receive_response = _fake_receive
    return client


@pytest.fixture()
def e2e_orchestrator(mock_sdk_client, event_store, memory_manager, state_store):
    """Full orchestrator with mock SDK client, real event store and memory."""
    factory = MagicMock()
    factory.create_client.return_value = mock_sdk_client

    orch = Orchestrator(
        client_factory=factory,
        event_store=event_store,
        memory_manager=memory_manager,
        state_store=state_store,
    )
    return orch


# ---------------------------------------------------------------------------
# Full Agent Flow
# ---------------------------------------------------------------------------

class TestFullAgentFlow:

    @pytest.mark.asyncio
    async def test_researcher_completes(self, e2e_orchestrator, mock_sdk_client):
        """Run researcher agent end-to-end and verify all lifecycle events."""
        e2e_orchestrator.start()
        reset_metrics()
        reset_costs()
        reset_counters()

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                result = await e2e_orchestrator.run_agent(
                    "researcher",
                    task="Analyze today's sales trends",
                )

        assert result["agent"] == "researcher"
        assert result["status"] == "completed"
        assert result["session_id"]
        assert result["duration_seconds"] >= 0
        mock_sdk_client.connect.assert_called_once()
        mock_sdk_client.query.assert_called_once()

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, e2e_orchestrator, mock_sdk_client):
        """Verify session is tracked and cleaned up correctly."""
        e2e_orchestrator.start()

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                # During run, session should be active
                result = await e2e_orchestrator.run_agent("designer")

        # After run, session should be cleaned up
        assert "designer" not in e2e_orchestrator._active_sessions
        assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_multiple_agents_sequential(self, e2e_orchestrator, mock_sdk_client):
        """Run multiple agents sequentially."""
        e2e_orchestrator.start()

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                r1 = await e2e_orchestrator.run_agent("researcher")
                r2 = await e2e_orchestrator.run_agent("seo_manager")

        assert r1["status"] == "completed"
        assert r2["status"] == "completed"
        assert r1["session_id"] != r2["session_id"]

    @pytest.mark.asyncio
    async def test_error_flow(self, e2e_orchestrator, mock_sdk_client):
        """Verify error handling when SDK client fails."""
        e2e_orchestrator.start()
        mock_sdk_client.connect.side_effect = ConnectionError("SDK unreachable")

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            result = await e2e_orchestrator.run_agent("finance")

        assert result["status"] == "error"
        assert "SDK unreachable" in result["error"]
        assert "finance" not in e2e_orchestrator._active_sessions


# ---------------------------------------------------------------------------
# Rate limit counters reset per session
# ---------------------------------------------------------------------------

class TestRateLimitPerSession:

    @pytest.mark.asyncio
    async def test_counters_reset_before_run(self, e2e_orchestrator, mock_sdk_client):
        """Orchestrator should reset rate limit counters before each agent run."""
        e2e_orchestrator.start()

        # Pre-fill some counters
        from podclaw.hooks.rate_limit_hook import _counters
        _counters["researcher"] = {"crawl_url": 99}

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                await e2e_orchestrator.run_agent("researcher")

        # After run, researcher's counters should have been reset (at the start of run)
        # Note: the counters are reset BEFORE the SDK call
        counters = get_counters()
        assert counters.get("researcher", {}).get("crawl_url", 0) == 0


# ---------------------------------------------------------------------------
# Concurrent session prevention
# ---------------------------------------------------------------------------

class TestConcurrentPrevention:

    @pytest.mark.asyncio
    async def test_same_agent_blocked_concurrent(self, e2e_orchestrator, mock_sdk_client):
        """Two concurrent runs of the same agent: one succeeds, one is skipped."""
        e2e_orchestrator.start()

        # Make the first run slow
        original_query = mock_sdk_client.query

        async def _slow_query(*args, **kwargs):
            await asyncio.sleep(0.5)
            return await original_query(*args, **kwargs)

        mock_sdk_client.query = _slow_query

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                results = await asyncio.gather(
                    e2e_orchestrator.run_agent("researcher"),
                    e2e_orchestrator.run_agent("researcher"),
                )

        statuses = {r["status"] for r in results}
        assert "completed" in statuses or "error" in statuses
        # At least one should be skipped
        assert "skipped" in statuses

    @pytest.mark.asyncio
    async def test_different_agents_can_run_concurrent(self, e2e_orchestrator, mock_sdk_client):
        """Two different agents should be able to run concurrently."""
        e2e_orchestrator.start()

        with patch.object(e2e_orchestrator, '_write_session_feedback'):
            with patch.object(e2e_orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                results = await asyncio.gather(
                    e2e_orchestrator.run_agent("researcher"),
                    e2e_orchestrator.run_agent("seo_manager"),
                )

        assert results[0]["status"] == "completed"
        assert results[1]["status"] == "completed"
