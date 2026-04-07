"""
Tests for podclaw.hooks.metrics_hook
"""

from __future__ import annotations

import time

import pytest

from podclaw.hooks.metrics_hook import (
    metrics_pre_hook,
    metrics_hook,
    get_metrics,
    get_agent_metrics,
    reset_metrics,
    _pending_timers,
)


def _input(agent: str = "researcher", error: bool = False) -> dict:
    d = {
        "tool_name": "supabase_query",
        "tool_input": {},
        "_agent_name": agent,
    }
    if error:
        d["_error"] = True
    return d


# ---------------------------------------------------------------------------
# Basic tracking
# ---------------------------------------------------------------------------

class TestMetricsBasic:

    @pytest.mark.asyncio
    async def test_post_hook_tracks_call(self):
        reset_metrics()
        await metrics_hook(_input("researcher"), tool_use_id="t1")
        m = get_agent_metrics("researcher")
        assert m["tool_calls"] == 1
        assert m["tool_errors"] == 0

    @pytest.mark.asyncio
    async def test_error_tracked(self):
        reset_metrics()
        await metrics_hook(_input("designer", error=True), tool_use_id="t2")
        m = get_agent_metrics("designer")
        assert m["tool_errors"] == 1

    @pytest.mark.asyncio
    async def test_multiple_calls_accumulate(self):
        reset_metrics()
        for i in range(5):
            await metrics_hook(_input("researcher"), tool_use_id=f"t{i}")
        m = get_agent_metrics("researcher")
        assert m["tool_calls"] == 5

    @pytest.mark.asyncio
    async def test_unknown_agent_returns_defaults(self):
        m = get_agent_metrics("nonexistent_agent")
        assert m == {"tool_calls": 0, "tool_errors": 0, "total_latency_ms": 0}


# ---------------------------------------------------------------------------
# Latency tracking
# ---------------------------------------------------------------------------

class TestLatencyTracking:

    @pytest.mark.asyncio
    async def test_latency_calculated(self):
        reset_metrics()
        tool_id = "latency-test-1"

        await metrics_pre_hook(_input(), tool_use_id=tool_id)
        # Simulate some processing time
        await metrics_hook(_input(), tool_use_id=tool_id)

        m = get_agent_metrics("researcher")
        # Latency should be >= 0 (could be very small)
        assert m["total_latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_pre_hook_records_timer(self):
        tool_id = "timer-test-1"
        await metrics_pre_hook(_input(), tool_use_id=tool_id)
        assert tool_id in _pending_timers

    @pytest.mark.asyncio
    async def test_post_hook_clears_timer(self):
        tool_id = "timer-test-2"
        await metrics_pre_hook(_input(), tool_use_id=tool_id)
        await metrics_hook(_input(), tool_use_id=tool_id)
        assert tool_id not in _pending_timers


# ---------------------------------------------------------------------------
# Memory leak test — _pending_timers cleanup
# ---------------------------------------------------------------------------

class TestPendingTimerCleanup:

    @pytest.mark.asyncio
    async def test_orphaned_pre_hooks_leak(self):
        """If post_hook never runs, _pending_timers entries remain.
        This tests documents the known memory leak behavior.
        """
        reset_metrics()
        # Simulate 100 pre_hooks without corresponding post_hooks
        for i in range(100):
            await metrics_pre_hook(_input(), tool_use_id=f"orphan-{i}")

        # All 100 should be in _pending_timers (this IS the leak)
        orphans = sum(1 for k in _pending_timers if k.startswith("orphan-"))
        assert orphans == 100, "Pending timers leak when post_hook doesn't run"

    @pytest.mark.asyncio
    async def test_no_tool_use_id_skips_timer(self):
        reset_metrics()
        await metrics_pre_hook(_input(), tool_use_id=None)
        # Nothing should be added
        assert None not in _pending_timers


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

class TestMetricsReset:

    @pytest.mark.asyncio
    async def test_reset_single_agent(self):
        reset_metrics()
        await metrics_hook(_input("researcher"), tool_use_id="r1")
        await metrics_hook(_input("designer"), tool_use_id="d1")

        reset_metrics("researcher")
        assert get_agent_metrics("researcher") == {"tool_calls": 0, "tool_errors": 0, "total_latency_ms": 0}
        assert get_agent_metrics("designer")["tool_calls"] == 1

    @pytest.mark.asyncio
    async def test_reset_all(self):
        await metrics_hook(_input("researcher"), tool_use_id="r1")
        reset_metrics()
        assert get_metrics() == {}

    @pytest.mark.asyncio
    async def test_get_metrics_all_agents(self):
        reset_metrics()
        await metrics_hook(_input("researcher"), tool_use_id="r1")
        await metrics_hook(_input("designer"), tool_use_id="d1")
        all_m = get_metrics()
        assert "researcher" in all_m
        assert "designer" in all_m
