"""
PodClaw — Hook Chain Integration Tests (Phase 6.4)
====================================================

Integration tests verifying the full hook chain:
security → cost_guard → rate_limit → [execute] → post hooks.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.hook_adapters import make_can_use_tool, make_sdk_hooks


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_deny_hook(name: str, should_deny: bool = False, deny_reason: str = ""):
    """Create a named hook that either allows or denies."""

    async def hook(input_data, tool_use_id, context):
        if should_deny:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": deny_reason,
                }
            }
        return {}

    hook.__name__ = name
    return hook


def _make_post_hook(name: str, side_effects: list | None = None):
    """Create a named post-tool hook that tracks calls."""
    calls = side_effects if side_effects is not None else []

    async def hook(input_data, tool_use_id, context):
        calls.append(name)
        return {}

    hook.__name__ = name
    hook._calls = calls
    return hook


# ---------------------------------------------------------------------------
# Pre-tool (deny chain) integration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_security_hook_blocks_disallowed_tool():
    """Security hook (first in chain) denies disallowed tools."""
    security = _make_deny_hook("security", should_deny=True, deny_reason="Tool not allowed")
    cost = _make_deny_hook("cost_guard")
    rate = _make_deny_hook("rate_limit")

    can_use = make_can_use_tool(
        pre_hooks=[security, cost, rate],
        agent_name="researcher",
        session_id="s1",
    )
    result = await can_use("mcp__supabase__supabase_delete", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"
    assert "not allowed" in result.message


@pytest.mark.asyncio
@pytest.mark.unit
async def test_cost_guard_blocks_over_budget():
    """Cost guard (second in chain) blocks when budget exceeded."""
    security = _make_deny_hook("security")
    cost = _make_deny_hook("cost_guard", should_deny=True, deny_reason="Budget exceeded")
    rate = _make_deny_hook("rate_limit")

    can_use = make_can_use_tool(
        pre_hooks=[security, cost, rate],
        agent_name="designer",
        session_id="s2",
    )
    result = await can_use("fal_generate_image", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"
    assert "Budget exceeded" in result.message


@pytest.mark.asyncio
@pytest.mark.unit
async def test_rate_limit_blocks_burst():
    """Rate limiter (third in chain) blocks when rate exceeded."""
    security = _make_deny_hook("security")
    cost = _make_deny_hook("cost_guard")
    rate = _make_deny_hook("rate_limit", should_deny=True, deny_reason="Rate limit exceeded")

    can_use = make_can_use_tool(
        pre_hooks=[security, cost, rate],
        agent_name="cataloger",
        session_id="s3",
    )
    result = await can_use("printful_create_product", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_full_chain_allowed_tool():
    """All hooks pass → tool allowed."""
    security = _make_deny_hook("security")
    cost = _make_deny_hook("cost_guard")
    rate = _make_deny_hook("rate_limit")

    can_use = make_can_use_tool(
        pre_hooks=[security, cost, rate],
        agent_name="researcher",
        session_id="s4",
    )
    result = await can_use("supabase_query", {}, None)
    assert result.__class__.__name__ == "PermissionResultAllow"


# ---------------------------------------------------------------------------
# Post-tool (observation) integration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_post_hooks_fire_on_success():
    """All post-hooks fire in order after tool success."""
    calls: list[str] = []
    sync = _make_post_hook("sync", calls)
    quality = _make_post_hook("quality_gate", calls)
    transparency = _make_post_hook("transparency", calls)
    memory = _make_post_hook("memory", calls)
    event_log = _make_post_hook("event_log", calls)
    metrics = _make_post_hook("metrics", calls)

    hooks = make_sdk_hooks(
        post_hooks=[sync, quality, transparency, memory, event_log, metrics],
        pre_observe_hooks=[],
        agent_name="researcher",
        session_id="s5",
    )

    # Simulate tool execution complete
    post_hook = hooks["PostToolUse"][0].hooks[0]
    await post_hook(
        {"tool_name": "supabase_query", "tool_input": {}, "tool_response": "data"},
        tool_use_id="tu1",
        context=None,
    )

    assert calls == ["sync", "quality_gate", "transparency", "memory", "event_log", "metrics"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_post_hooks_fail_open():
    """One post-hook erroring doesn't stop others."""
    calls: list[str] = []

    async def error_hook(input_data, tool_use_id, context):
        calls.append("error_hook")
        raise RuntimeError("Hook crashed")

    error_hook.__name__ = "error_hook"
    good = _make_post_hook("good_hook", calls)

    hooks = make_sdk_hooks(
        post_hooks=[error_hook, good],
        pre_observe_hooks=[],
        agent_name="researcher",
        session_id="s6",
    )

    post_hook = hooks["PostToolUse"][0].hooks[0]
    await post_hook(
        {"tool_name": "supabase_query", "tool_input": {}, "tool_response": "data"},
        tool_use_id="tu2",
        context=None,
    )

    # Both hooks were called despite the error
    assert "error_hook" in calls
    assert "good_hook" in calls


@pytest.mark.asyncio
@pytest.mark.unit
async def test_full_chain_records_metrics():
    """Metrics hook captures data after tool execution."""
    recorded: list[dict] = []

    async def metrics_hook(input_data, tool_use_id, context):
        recorded.append({
            "tool": input_data.get("tool_name"),
            "agent": input_data.get("_agent_name"),
        })
        return {}

    metrics_hook.__name__ = "metrics"

    hooks = make_sdk_hooks(
        post_hooks=[metrics_hook],
        pre_observe_hooks=[],
        agent_name="designer",
        session_id="s7",
    )

    post_hook = hooks["PostToolUse"][0].hooks[0]
    await post_hook(
        {"tool_name": "mcp__fal__fal_generate_image", "tool_input": {}, "tool_response": "img_url"},
        tool_use_id="tu3",
        context=None,
    )

    assert len(recorded) == 1
    assert recorded[0]["tool"] == "fal_generate_image"
    assert recorded[0]["agent"] == "designer"
