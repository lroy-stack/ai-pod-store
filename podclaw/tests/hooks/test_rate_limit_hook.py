"""
Tests for podclaw.hooks.rate_limit_hook
"""

from __future__ import annotations

import asyncio

import pytest

from podclaw.hooks.rate_limit_hook import (
    rate_limit_hook,
    reset_counters,
    get_counters,
    _counters,
)


def _input(tool_name: str, agent: str = "designer") -> dict:
    return {
        "tool_name": tool_name,
        "tool_input": {},
        "_agent_name": agent,
    }


def _is_deny(result: dict) -> bool:
    return result.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"


# ---------------------------------------------------------------------------
# Basic allow/deny
# ---------------------------------------------------------------------------

class TestRateLimitBasic:

    @pytest.mark.asyncio
    async def test_unlimited_tool_always_allowed(self):
        """Tools without rate limits should always pass."""
        result = await rate_limit_hook(_input("supabase_query", "researcher"))
        assert not _is_deny(result)

    @pytest.mark.asyncio
    async def test_first_call_within_limit_allowed(self):
        result = await rate_limit_hook(_input("fal_generate", "designer"))
        assert not _is_deny(result)

    @pytest.mark.asyncio
    async def test_exceeds_limit_denied(self):
        """designer has fal_generate limit of 10."""
        agent = "designer"
        tool = "fal_generate"
        reset_counters(agent)

        for i in range(10):
            result = await rate_limit_hook(_input(tool, agent))
            assert not _is_deny(result), f"Call {i+1} should be allowed"

        # 11th call should be denied
        result = await rate_limit_hook(_input(tool, agent))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_different_agents_independent(self):
        """Rate limits are per-agent, not global."""
        reset_counters()
        # Use up designer's fal_generate limit
        for _ in range(10):
            await rate_limit_hook(_input("fal_generate", "designer"))

        # researcher doesn't have fal_generate limit → should pass
        result = await rate_limit_hook(_input("fal_generate", "researcher"))
        assert not _is_deny(result)


# ---------------------------------------------------------------------------
# Counter management
# ---------------------------------------------------------------------------

class TestCounterManagement:

    @pytest.mark.asyncio
    async def test_reset_single_agent(self):
        await rate_limit_hook(_input("fal_generate", "designer"))
        assert "designer" in get_counters()

        reset_counters("designer")
        assert "designer" not in get_counters()

    @pytest.mark.asyncio
    async def test_reset_all_agents(self):
        await rate_limit_hook(_input("fal_generate", "designer"))
        await rate_limit_hook(_input("crawl_url", "researcher"))

        reset_counters()
        assert get_counters() == {}

    @pytest.mark.asyncio
    async def test_counter_increments(self):
        agent = "designer"
        tool = "fal_generate"
        reset_counters(agent)

        await rate_limit_hook(_input(tool, agent))
        await rate_limit_hook(_input(tool, agent))

        counters = get_counters()
        assert counters[agent][tool] == 2


# ---------------------------------------------------------------------------
# Concurrent access
# ---------------------------------------------------------------------------

class TestRateLimitConcurrency:

    @pytest.mark.asyncio
    async def test_concurrent_calls_respect_limit(self):
        """Verify concurrent calls don't overshoot the limit."""
        agent = "designer"
        tool = "fal_generate"  # limit = 10
        reset_counters(agent)

        # Fire 20 concurrent calls
        results = await asyncio.gather(*[
            rate_limit_hook(_input(tool, agent))
            for _ in range(20)
        ])

        allowed = sum(1 for r in results if not _is_deny(r))
        denied = sum(1 for r in results if _is_deny(r))

        # Exactly 10 should be allowed
        assert allowed == 10
        assert denied == 10
