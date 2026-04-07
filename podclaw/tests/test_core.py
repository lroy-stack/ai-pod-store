"""
Tests for podclaw.core — Orchestrator
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.core import Orchestrator, AGENT_NAMES


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_factory():
    factory = MagicMock()
    factory.create_client = MagicMock()
    return factory


@pytest.fixture()
def mock_event_store():
    store = AsyncMock()
    store.record = AsyncMock(return_value="event-id")
    store.record_session = AsyncMock()
    store.update_session = AsyncMock()
    store.record_audit = AsyncMock()
    store._client = None  # No Supabase → circuit breaker disabled
    return store


@pytest.fixture()
def mock_memory():
    mm = MagicMock()
    mm.append_daily = AsyncMock()
    mm.context_dir = MagicMock()
    mm.context_dir.__truediv__ = MagicMock(return_value=MagicMock())
    return mm


@pytest.fixture()
def orchestrator(mock_factory, mock_event_store, mock_memory, state_store):
    return Orchestrator(
        client_factory=mock_factory,
        event_store=mock_event_store,
        memory_manager=mock_memory,
        state_store=state_store,
    )


# ---------------------------------------------------------------------------
# Init & Status
# ---------------------------------------------------------------------------

class TestOrchestratorInit:

    def test_agents_list(self):
        assert len(AGENT_NAMES) == 10
        assert "researcher" in AGENT_NAMES
        assert "designer" in AGENT_NAMES
        assert "finance" in AGENT_NAMES

    def test_initial_state(self, orchestrator):
        assert not orchestrator.is_running
        assert orchestrator._active_sessions == {}

    @pytest.mark.asyncio
    async def test_start_sets_running(self, orchestrator):
        orchestrator.start()
        assert orchestrator.is_running

    @pytest.mark.asyncio
    async def test_stop_clears_state(self, orchestrator):
        orchestrator.start()
        orchestrator._active_sessions["researcher"] = "sess-1"
        orchestrator.stop()
        assert not orchestrator.is_running
        assert orchestrator._active_sessions == {}

    @pytest.mark.asyncio
    async def test_get_status(self, orchestrator):
        orchestrator.start()
        status = orchestrator.get_status()
        assert status["running"] is True
        assert status["agent_count"] == 10
        assert "researcher" in status["agents"]

    def test_get_agent_status(self, orchestrator):
        status = orchestrator.get_agent_status("researcher")
        assert status["agent"] == "researcher"
        assert status["running"] is False
        assert status["disabled"] is False


# ---------------------------------------------------------------------------
# Run Agent — Basic
# ---------------------------------------------------------------------------

class TestRunAgentBasic:

    @pytest.mark.asyncio
    async def test_unknown_agent_returns_error(self, orchestrator):
        orchestrator.start()
        result = await orchestrator.run_agent("nonexistent_agent")
        assert result["status"] == "error"
        assert "unknown agent" in result["reason"]

    @pytest.mark.asyncio
    async def test_not_running_returns_skipped(self, orchestrator):
        result = await orchestrator.run_agent("researcher")
        assert result["status"] == "skipped"
        assert "not running" in result["reason"]

    @pytest.mark.asyncio
    async def test_concurrent_same_agent_skipped(self, orchestrator):
        orchestrator.start()
        orchestrator._active_sessions["researcher"] = "existing-sess"
        result = await orchestrator.run_agent("researcher")
        assert result["status"] == "skipped"
        assert "already running" in result["reason"]


# ---------------------------------------------------------------------------
# Run Agent — SDK Execution
# ---------------------------------------------------------------------------

class TestRunAgentExecution:

    @pytest.mark.asyncio
    async def test_successful_run(self, orchestrator, mock_factory, mock_event_store, mock_memory):
        """Test happy path: agent runs successfully with mocked SDK client."""
        orchestrator.start()

        # Mock SDK client
        mock_client = AsyncMock()
        mock_client.connect = AsyncMock()
        mock_client.disconnect = AsyncMock()
        mock_client.query = AsyncMock()

        # Simulate SDK response: one TextBlock then ResultMessage
        from unittest.mock import PropertyMock

        text_block = MagicMock()
        text_block.content = [MagicMock()]
        text_block.content[0].__class__.__name__ = "TextBlock"
        type(text_block.content[0]).text = PropertyMock(return_value="Research complete.")

        result_msg = MagicMock()
        result_msg.__class__.__name__ = "ResultMessage"
        result_msg.num_turns = 3
        result_msg.total_cost_usd = 0.05
        result_msg.session_id = "sdk-sess-123"
        result_msg.usage = {"input_tokens": 100, "output_tokens": 50}

        # The SDK's receive_response is an async iterator
        async def _fake_receive():
            yield text_block
            from claude_agent_sdk import ResultMessage as RM
            rm = MagicMock(spec=RM)
            rm.num_turns = 3
            rm.total_cost_usd = 0.05
            rm.session_id = "sdk-sess-123"
            rm.usage = {}
            yield rm

        mock_client.receive_response = _fake_receive
        mock_factory.create_client.return_value = mock_client

        # Patch _write_session_feedback to avoid file I/O
        with patch.object(orchestrator, '_write_session_feedback'):
            with patch.object(orchestrator, '_extract_and_persist_learnings', new_callable=AsyncMock):
                result = await orchestrator.run_agent("researcher", task="Test task")

        assert result["agent"] == "researcher"
        assert result["status"] == "completed"
        assert "session_id" in result
        assert "duration_seconds" in result
        mock_client.connect.assert_called_once()
        mock_client.query.assert_called_once_with("Test task")

    @pytest.mark.asyncio
    async def test_error_records_event(self, orchestrator, mock_factory, mock_event_store):
        """When SDK client raises, error is recorded and status is 'error'."""
        orchestrator.start()

        mock_client = AsyncMock()
        mock_client.connect = AsyncMock(side_effect=RuntimeError("SDK crash"))
        mock_client.disconnect = AsyncMock()
        mock_factory.create_client.return_value = mock_client

        with patch.object(orchestrator, '_write_session_feedback'):
            result = await orchestrator.run_agent("researcher")

        assert result["status"] == "error"
        assert "SDK crash" in result["error"]

    @pytest.mark.asyncio
    async def test_session_cleaned_up_after_run(self, orchestrator, mock_factory):
        """Active session should be removed after run completes."""
        orchestrator.start()

        mock_client = AsyncMock()
        mock_client.connect = AsyncMock(side_effect=RuntimeError("fail"))
        mock_client.disconnect = AsyncMock()
        mock_factory.create_client.return_value = mock_client

        with patch.object(orchestrator, '_write_session_feedback'):
            await orchestrator.run_agent("researcher")

        assert "researcher" not in orchestrator._active_sessions


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

class TestCircuitBreaker:

    @pytest.mark.asyncio
    async def test_circuit_breaker_without_db_allows(self, orchestrator):
        """No Supabase client → fail-open → should allow."""
        is_open = await orchestrator._check_circuit_breaker("researcher")
        assert is_open is False

    @pytest.mark.asyncio
    async def test_circuit_breaker_with_few_errors_allows(self, orchestrator):
        """< 3 errors → allow."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.count = 2
        mock_result.data = [{"id": "1"}, {"id": "2"}]
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = mock_result
        orchestrator.events._client = mock_client

        is_open = await orchestrator._check_circuit_breaker("researcher")
        assert is_open is False

    @pytest.mark.asyncio
    async def test_circuit_breaker_with_many_errors_blocks(self, orchestrator):
        """≥ 3 errors → block."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.count = 5
        mock_result.data = [{"id": str(i)} for i in range(5)]
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = mock_result
        orchestrator.events._client = mock_client

        is_open = await orchestrator._check_circuit_breaker("researcher")
        assert is_open is True


# ---------------------------------------------------------------------------
# Default Tasks
# ---------------------------------------------------------------------------

class TestDefaultTasks:

    def test_all_agents_have_default_task(self, orchestrator):
        for agent in AGENT_NAMES:
            task = orchestrator._default_task(agent)
            assert len(task) > 50, f"{agent} default task is too short"
            assert "You MUST call tools" in task

    def test_unknown_agent_fallback(self, orchestrator):
        task = orchestrator._default_task("nonexistent")
        assert "standard" in task.lower()


# ---------------------------------------------------------------------------
# Run Agent with Retry
# ---------------------------------------------------------------------------

class TestRunAgentWithRetry:

    @pytest.mark.asyncio
    async def test_retry_on_failure(self, orchestrator, mock_factory):
        orchestrator.start()
        call_count = 0

        async def _run_agent_side_effect(agent, task=None, force_fresh=False):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return {"status": "error", "error": "transient"}
            return {"status": "completed"}

        with patch.object(orchestrator, 'run_agent', side_effect=_run_agent_side_effect):
            result = await orchestrator.run_agent_with_retry("researcher", max_retries=2)

        assert result["status"] == "completed"
        assert call_count == 3


# ---------------------------------------------------------------------------
# State Store
# ---------------------------------------------------------------------------

class TestStateStore:

    @pytest.mark.asyncio
    async def test_set_and_get(self, state_store):
        await state_store.set("test_key", {"a": 1})
        val = await state_store.get("test_key")
        assert val == {"a": 1}

    @pytest.mark.asyncio
    async def test_get_default(self, state_store):
        val = await state_store.get("nonexistent", "default_val")
        assert val == "default_val"

    @pytest.mark.asyncio
    async def test_delete(self, state_store):
        await state_store.set("to_delete", 42)
        await state_store.delete("to_delete")
        val = await state_store.get("to_delete")
        assert val is None

    @pytest.mark.asyncio
    async def test_keys(self, state_store):
        await state_store.set("k1", "v1")
        await state_store.set("k2", "v2")
        keys = await state_store.keys()
        assert "k1" in keys
        assert "k2" in keys

    @pytest.mark.asyncio
    async def test_overwrite(self, state_store):
        await state_store.set("key", "first")
        await state_store.set("key", "second")
        val = await state_store.get("key")
        assert val == "second"


# ---------------------------------------------------------------------------
# Event Store (local mode)
# ---------------------------------------------------------------------------

class TestEventStore:

    @pytest.mark.asyncio
    async def test_record_returns_uuid(self, event_store):
        event_id = await event_store.record("researcher", "test_event", {"data": 1})
        assert len(event_id) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_query_without_client_returns_empty(self, event_store):
        results = await event_store.query(agent_name="researcher")
        assert results == []

    @pytest.mark.asyncio
    async def test_record_session_without_client_noop(self, event_store):
        # Should not raise
        await event_store.record_session("sess-1", "researcher")

    @pytest.mark.asyncio
    async def test_update_session_without_client_noop(self, event_store):
        await event_store.update_session("sess-1", "completed", tool_calls=5)


# ---------------------------------------------------------------------------
# Agent Kill-Switch
# ---------------------------------------------------------------------------

class TestAgentKillSwitch:

    @pytest.mark.asyncio
    async def test_disabled_agent_is_skipped(self, orchestrator):
        """A disabled agent should return 'skipped'."""
        orchestrator.start()
        await orchestrator.disable_agent("researcher")
        result = await orchestrator.run_agent("researcher")
        assert result["status"] == "skipped"
        assert "disabled" in result["reason"]

    @pytest.mark.asyncio
    async def test_enable_agent_allows_run(self, orchestrator, mock_factory):
        """Re-enabling an agent should allow it to run again."""
        orchestrator.start()
        await orchestrator.disable_agent("researcher")
        await orchestrator.enable_agent("researcher")

        # Should not be skipped now (will fail at SDK connect, but not "disabled")
        mock_client = AsyncMock()
        mock_client.connect = AsyncMock(side_effect=RuntimeError("test"))
        mock_client.disconnect = AsyncMock()
        mock_factory.create_client.return_value = mock_client

        with patch.object(orchestrator, '_write_session_feedback'):
            result = await orchestrator.run_agent("researcher")

        assert result["status"] == "error"
        assert "disabled" not in result.get("reason", "")

    @pytest.mark.asyncio
    async def test_disabled_persists_in_state_store(self, orchestrator, state_store):
        """Disabled agents should be persisted in StateStore."""
        orchestrator.start()
        await orchestrator.disable_agent("designer")

        stored = await state_store.get("disabled_agents")
        assert "designer" in stored

    @pytest.mark.asyncio
    async def test_agent_status_includes_disabled(self, orchestrator):
        """get_agent_status should include 'disabled' field."""
        await orchestrator.disable_agent("finance")
        status = orchestrator.get_agent_status("finance")
        assert status["disabled"] is True

        await orchestrator.enable_agent("finance")
        status = orchestrator.get_agent_status("finance")
        assert status["disabled"] is False
