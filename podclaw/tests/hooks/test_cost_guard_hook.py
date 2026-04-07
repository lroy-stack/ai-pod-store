"""
Tests for podclaw.hooks.cost_guard_hook
"""

from __future__ import annotations

import asyncio

import pytest

from podclaw.hooks.cost_guard_hook import (
    cost_guard_hook,
    get_daily_costs,
    record_session_cost,
    reset_costs,
    _daily_costs,
    _cost_lock,
    _today_key,
    TOOL_COSTS,
)


def _input(tool_name: str, agent: str = "researcher") -> dict:
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

class TestCostGuardBasic:

    @pytest.mark.asyncio
    async def test_first_call_allowed(self):
        result = await cost_guard_hook(_input("supabase_query", "researcher"))
        assert not _is_deny(result)

    @pytest.mark.asyncio
    async def test_free_tool_allowed(self):
        """Tools with cost 0.0 should always be allowed."""
        result = await cost_guard_hook(_input("supabase_query", "qa_inspector"))
        assert not _is_deny(result)

    @pytest.mark.asyncio
    async def test_budget_exceeded_denied(self):
        """Fill up the budget, then verify denial."""
        agent = "qa_inspector"  # budget = 0.15 EUR

        # Exhaust budget with expensive tools
        for _ in range(200):
            result = await cost_guard_hook(_input("fal_generate", agent))
            if _is_deny(result):
                break
        else:
            pytest.fail("Budget was never exceeded after 200 calls")

        # Next call should still be denied
        result = await cost_guard_hook(_input("fal_generate", agent))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Cost tracking
# ---------------------------------------------------------------------------

class TestCostTracking:

    @pytest.mark.asyncio
    async def test_cost_accumulates(self):
        """Each call increments the daily total."""
        agent = "marketing"
        # fal_generate costs 0.05
        await cost_guard_hook(_input("fal_generate", agent))
        await cost_guard_hook(_input("fal_generate", agent))
        costs = get_daily_costs()
        assert costs.get(agent, 0) >= 0.09  # 2 * 0.05 = 0.10 (approx, with float)

    @pytest.mark.asyncio
    async def test_reset_clears_costs(self):
        await cost_guard_hook(_input("fal_generate", "designer"))
        reset_costs()
        costs = get_daily_costs()
        assert costs.get("designer", 0) == 0

    @pytest.mark.asyncio
    async def test_unknown_tool_has_default_cost(self):
        """Unknown tools get 0.001 default cost."""
        agent = "researcher"
        await cost_guard_hook(_input("totally_unknown_tool", agent))
        costs = get_daily_costs()
        assert costs.get(agent, 0) >= 0.001


# ---------------------------------------------------------------------------
# Session cost recording
# ---------------------------------------------------------------------------

class TestSessionCost:

    @pytest.mark.asyncio
    async def test_record_session_cost_adds_to_daily(self):
        agent = "finance"
        reset_costs()
        await record_session_cost(agent, 0.50)  # $0.50 USD → ~€0.46 EUR
        costs = get_daily_costs()
        assert costs.get(agent, 0) > 0.4


# ---------------------------------------------------------------------------
# TOCTOU race condition test
# ---------------------------------------------------------------------------

class TestCostGuardAtomicity:

    @pytest.mark.asyncio
    async def test_concurrent_calls_respect_budget(self):
        """Verify that concurrent calls can't both pass when only one should."""
        agent = "qa_inspector"  # budget = 0.15 EUR
        reset_costs()

        # Pre-fill close to budget
        while True:
            costs = get_daily_costs()
            if costs.get(agent, 0) >= 0.10:
                break
            await cost_guard_hook(_input("fal_generate", agent))

        # Fire 10 concurrent calls — not all should pass
        results = await asyncio.gather(*[
            cost_guard_hook(_input("fal_generate", agent))
            for _ in range(10)
        ])

        denials = sum(1 for r in results if _is_deny(r))
        assert denials > 0, "At least some calls should be denied when budget is nearly full"


# ---------------------------------------------------------------------------
# Global daily spend limit
# ---------------------------------------------------------------------------

class TestGlobalDailySpendLimit:

    @pytest.mark.asyncio
    async def test_global_limit_blocks_when_exceeded(self):
        """When total spend across all agents exceeds EUR 30, deny."""
        reset_costs()
        today = _today_key()
        # Pre-fill: simulate EUR 29.98 already spent across agents
        _daily_costs[today] = {"designer": 15.0, "cataloger": 14.98}

        # Next call should be denied (fal_generate costs 0.05)
        result = await cost_guard_hook(_input("fal_generate", "researcher"))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_global_limit_allows_when_under(self):
        """When total spend is under EUR 30, allow."""
        reset_costs()
        today = _today_key()
        _daily_costs[today] = {"designer": 5.0, "cataloger": 5.0}

        result = await cost_guard_hook(_input("supabase_query", "researcher"))
        assert not _is_deny(result)
