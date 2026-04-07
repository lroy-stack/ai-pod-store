"""
Tests for podclaw.heartbeat — HeartbeatRunner

Tests mock the LLM call and focus on the decision logic, active hours,
dedup, and dispatch mechanisms.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.heartbeat import HeartbeatRunner


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={"status": "completed", "tool_calls": 3, "total_cost_usd": 0.05})
    orch.is_running = True
    return orch


@pytest.fixture()
def mock_event_store():
    store = MagicMock()
    store._client = None  # No Supabase
    return store


@pytest.fixture()
def mock_memory():
    mm = MagicMock()
    mm.read_heartbeat.return_value = "# HEARTBEAT\n- Check orders\n- Monitor errors"
    mm.read_daily_tail.return_value = "10:00 researcher completed, 3 tools"
    return mm


@pytest.fixture()
def mock_event_queue():
    eq = AsyncMock()
    eq.drain = AsyncMock(return_value=[])
    eq.peek = AsyncMock(return_value=[])
    eq.size = 0
    return eq


@pytest.fixture()
def runner(mock_orchestrator, mock_event_store, mock_memory, mock_event_queue, tmp_path):
    return HeartbeatRunner(
        orchestrator=mock_orchestrator,
        event_store=mock_event_store,
        memory_manager=mock_memory,
        event_queue=mock_event_queue,
        workspace=tmp_path,
        interval_minutes=30,
        active_hours=(5, 23),
    )


# ---------------------------------------------------------------------------
# Active hours
# ---------------------------------------------------------------------------

class TestActiveHours:

    def test_within_active_hours(self, runner):
        noon = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        assert runner._is_active_hours(noon) is True

    def test_before_active_hours(self, runner):
        early = datetime(2026, 2, 22, 3, 0, tzinfo=timezone.utc)
        assert runner._is_active_hours(early) is False

    def test_at_boundary_start(self, runner):
        start = datetime(2026, 2, 22, 5, 0, tzinfo=timezone.utc)
        assert runner._is_active_hours(start) is True

    def test_at_boundary_end(self, runner):
        end = datetime(2026, 2, 22, 23, 0, tzinfo=timezone.utc)
        assert runner._is_active_hours(end) is False


# ---------------------------------------------------------------------------
# Dedup
# ---------------------------------------------------------------------------

class TestDedup:

    def test_new_fingerprint_not_duplicate(self, runner):
        assert runner._is_duplicate("abc123") is False

    def test_seen_fingerprint_is_duplicate(self, runner):
        now = datetime.now(timezone.utc)
        runner._seen_alerts["abc123"] = now
        assert runner._is_duplicate("abc123") is True

    def test_expired_fingerprint_not_duplicate(self, runner):
        old = datetime.now(timezone.utc) - timedelta(hours=100)
        runner._seen_alerts["abc123"] = old
        assert runner._is_duplicate("abc123") is False

    def test_cleanup_stale_alerts(self, runner):
        now = datetime.now(timezone.utc)
        runner._seen_alerts["fresh"] = now
        runner._seen_alerts["stale"] = now - timedelta(hours=100)
        runner._cleanup_stale_alerts(now)
        assert "fresh" in runner._seen_alerts
        assert "stale" not in runner._seen_alerts


# ---------------------------------------------------------------------------
# Build prompt
# ---------------------------------------------------------------------------

class TestBuildPrompt:

    def test_build_prompt_includes_sections(self, runner):
        now = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        prompt = runner._build_prompt("# HEARTBEAT", "activity log", [], now)
        assert "HEARTBEAT.md" in prompt
        assert "Today's Activity" in prompt
        assert "Pending System Events" in prompt
        assert "REMINDER" in prompt

    def test_build_prompt_with_events(self, runner):
        now = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        mock_event = MagicMock()
        mock_event.source = "memory_hook"
        mock_event.event_type = "pricing_alert"
        mock_event.payload = {"message": "Negative margin on product X"}
        prompt = runner._build_prompt("# HB", "log", [mock_event], now)
        assert "pricing_alert" in prompt

    def test_build_prompt_empty_inputs(self, runner):
        now = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        prompt = runner._build_prompt("", "", [], now)
        assert "(empty)" in prompt


# ---------------------------------------------------------------------------
# Run once
# ---------------------------------------------------------------------------

class TestRunOnce:

    async def test_skip_outside_active_hours(self, runner):
        # Set to 3 AM — outside active hours
        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 3, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await runner.run_once()
        assert result["status"] == "skipped"
        assert "active hours" in result["reason"]

    async def test_skip_no_input(self, runner, mock_memory, mock_event_queue):
        mock_memory.read_heartbeat.return_value = ""
        mock_memory.read_daily_tail.return_value = ""
        mock_event_queue.drain = AsyncMock(return_value=[])

        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await runner.run_once()
        assert result["status"] == "skipped"

    async def test_heartbeat_ok_response(self, runner):
        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            with patch.object(runner, "_call_llm", new=AsyncMock(return_value=[
                {"status": "HEARTBEAT_OK", "priority": 1, "agent": None, "message": "All clear", "task": None}
            ])):
                result = await runner.run_once()
        assert result["status"] == "ok"
        assert len(result["actions"]) == 1
        assert result["run"] == 1

    async def test_dispatch_response(self, runner, mock_orchestrator):
        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            with patch.object(runner, "_call_llm", new=AsyncMock(return_value=[
                {"status": "DISPATCH", "priority": 2, "agent": "researcher", "message": "Trends needed", "task": "Research today's trends"}
            ])):
                with patch.object(runner, "_record_event", new=AsyncMock()):
                    result = await runner.run_once()
        assert result["status"] == "ok"
        dispatch_actions = [a for a in result["actions"] if a["status"] == "DISPATCH"]
        assert len(dispatch_actions) == 1
        assert dispatch_actions[0]["agent"] == "researcher"

    async def test_invalid_agent_in_dispatch_ignored(self, runner):
        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            with patch.object(runner, "_call_llm", new=AsyncMock(return_value=[
                {"status": "DISPATCH", "priority": 2, "agent": "nonexistent_agent", "message": "Bad", "task": "Do stuff"}
            ])):
                with patch.object(runner, "_record_event", new=AsyncMock()):
                    result = await runner.run_once()
        # Invalid agent should be set to None, so DISPATCH won't trigger
        assert result["status"] == "ok"

    async def test_llm_error_returns_error(self, runner):
        with patch("podclaw.heartbeat.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            with patch.object(runner, "_call_llm", new=AsyncMock(side_effect=Exception("LLM crash"))):
                result = await runner.run_once()
        assert result["status"] == "error"
        assert "LLM crash" in result["reason"]


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

class TestStatus:

    def test_get_status(self, runner):
        status = runner.get_status()
        assert status["running"] is False
        assert status["paused"] is False
        assert status["interval_minutes"] == 30
        assert "05:00" in status["active_hours"]
        assert "23:00" in status["active_hours"]
        assert status["total_runs"] == 0

    def test_status_after_run(self, runner):
        runner._total_runs = 5
        runner._total_alerts = 2
        runner._total_dispatches = 1
        runner._last_run = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        status = runner.get_status()
        assert status["total_runs"] == 5
        assert status["total_alerts"] == 2
        assert status["total_dispatches"] == 1
        assert status["last_run"] is not None


# ---------------------------------------------------------------------------
# Start/Stop/Pause
# ---------------------------------------------------------------------------

class TestLifecycle:

    def test_initial_state(self, runner):
        assert runner._running is False
        assert runner._paused is False

    def test_stop_sets_running_false(self, runner):
        runner._running = True
        runner.stop()
        assert runner._running is False

    def test_pause_and_resume(self, runner):
        runner.pause()
        assert runner._paused is True
        runner.resume()
        assert runner._paused is False


# ---------------------------------------------------------------------------
# Mechanical checks
# ---------------------------------------------------------------------------

class TestMechanicalChecks:

    async def test_no_gap_alert_first_run(self, runner):
        """First run (no _last_run) should not produce gap alert."""
        now = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)
        alerts = await runner._run_mechanical_checks(now)
        assert not any("gap" in a.lower() for a in alerts)

    async def test_gap_alert_when_overdue(self, runner):
        """Large gap between runs should produce alert."""
        runner._last_run = datetime(2026, 2, 22, 6, 0, tzinfo=timezone.utc)
        now = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)  # 6 hours gap
        alerts = await runner._run_mechanical_checks(now)
        assert any("gap" in a.lower() for a in alerts)

    async def test_no_gap_alert_normal_interval(self, runner):
        """Normal interval should not produce gap alert."""
        now = datetime(2026, 2, 22, 12, 30, tzinfo=timezone.utc)
        runner._last_run = datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc)  # 30 min gap
        alerts = await runner._run_mechanical_checks(now)
        assert not any("gap" in a.lower() for a in alerts)


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------

class TestCircuitBreaker:

    async def test_no_db_allows_dispatch(self, runner):
        """Without Supabase client, circuit breaker should be fail-open."""
        is_open = await runner._check_circuit_breaker("researcher")
        assert is_open is False

    async def test_dispatch_agent_validates_name(self, runner):
        """Invalid agent name should be rejected."""
        with patch.object(runner, "_record_event", new=AsyncMock()):
            await runner._dispatch_agent("invalid_agent_xyz", "test task")
        runner.orchestrator.run_agent.assert_not_called()
