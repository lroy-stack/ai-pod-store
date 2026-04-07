"""
PodClaw — Hook Adapters Tests (Phase 6.2)
============================================

Tests for can_use_tool deny chain, PreCompact hook (mechanical + LLM),
stop/failure hooks, and helper functions.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.hook_adapters import (
    _extract_observations,
    _short_name,
    make_can_use_tool,
    make_failure_hook,
    make_precompact_hook,
    make_stop_hook,
)


# ---------------------------------------------------------------------------
# _short_name
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_short_name_mcp_tool():
    assert _short_name("mcp__supabase__supabase_query") == "supabase_query"


@pytest.mark.unit
def test_short_name_builtin():
    assert _short_name("Read") == "Read"


@pytest.mark.unit
def test_short_name_partial_mcp():
    assert _short_name("mcp__only") == "mcp__only"


# ---------------------------------------------------------------------------
# can_use_tool deny chain
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_allows_when_no_hooks():
    """Empty hook list → always allow."""
    can_use = make_can_use_tool(pre_hooks=[], agent_name="researcher", session_id="s1")
    result = await can_use("supabase_query", {}, None)
    assert result.__class__.__name__ == "PermissionResultAllow"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_denies_on_security_hook_deny():
    """Hook returning deny → PermissionResultDeny."""

    async def deny_hook(input_data, tool_use_id, context):
        return {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": "Blocked by security",
            }
        }

    can_use = make_can_use_tool(pre_hooks=[deny_hook], agent_name="researcher", session_id="s1")
    result = await can_use("dangerous_tool", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"
    assert "Blocked by security" in result.message


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_denies_on_security_hook_error():
    """Security hook (index 0) raises → FAIL-CLOSED (deny)."""

    async def error_hook(input_data, tool_use_id, context):
        raise RuntimeError("Hook exploded")

    can_use = make_can_use_tool(pre_hooks=[error_hook], agent_name="researcher", session_id="s1")
    result = await can_use("any_tool", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_allows_on_cost_hook_error():
    """Cost hook (index 1) raises → FAIL-OPEN (allow)."""

    async def ok_security(input_data, tool_use_id, context):
        return {}

    async def error_cost(input_data, tool_use_id, context):
        raise RuntimeError("Cost check failed")

    can_use = make_can_use_tool(
        pre_hooks=[ok_security, error_cost],
        agent_name="researcher",
        session_id="s1",
    )
    result = await can_use("supabase_query", {}, None)
    assert result.__class__.__name__ == "PermissionResultAllow"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_denies_on_security_hook_timeout():
    """Security hook (index 0) times out → FAIL-CLOSED (deny)."""

    async def slow_hook(input_data, tool_use_id, context):
        await asyncio.sleep(30)

    can_use = make_can_use_tool(pre_hooks=[slow_hook], agent_name="researcher", session_id="s1")
    result = await can_use("any_tool", {}, None)
    assert result.__class__.__name__ == "PermissionResultDeny"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_can_use_tool_allows_on_cost_hook_timeout():
    """Cost hook (index 1) times out → FAIL-OPEN (allow)."""

    async def ok_security(input_data, tool_use_id, context):
        return {}

    async def slow_cost(input_data, tool_use_id, context):
        await asyncio.sleep(30)

    can_use = make_can_use_tool(
        pre_hooks=[ok_security, slow_cost],
        agent_name="researcher",
        session_id="s1",
    )
    result = await can_use("supabase_query", {}, None)
    assert result.__class__.__name__ == "PermissionResultAllow"


# ---------------------------------------------------------------------------
# _extract_observations (mechanical)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_extract_observations_counts_tools():
    messages = [
        {"role": "assistant", "content": [
            {"type": "tool_use", "name": "supabase_query"},
            {"type": "tool_use", "name": "crawl_url"},
            {"type": "text", "text": "x" * 100},
        ]},
    ]
    result = _extract_observations(messages, "researcher")
    assert "Used 2 tools" in result


@pytest.mark.unit
def test_extract_observations_caps_at_10():
    messages = [
        {"role": "assistant", "content": [
            {"type": "text", "text": f"Observation number {i} " + "x" * 100}
            for i in range(20)
        ]},
    ]
    result = _extract_observations(messages, "researcher")
    lines = [l for l in result.strip().splitlines() if l.startswith("- ")]
    assert len(lines) <= 10


@pytest.mark.unit
def test_extract_observations_skips_short_text():
    messages = [
        {"role": "assistant", "content": [{"type": "text", "text": "OK"}]},
    ]
    result = _extract_observations(messages, "researcher")
    # Short text (<80 chars) is skipped, only tool count if any
    assert result == ""


# ---------------------------------------------------------------------------
# PreCompact hook
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_precompact_archives_transcript(memory_manager, tmp_workspace):
    """PreCompact hook archives transcript when transcript_path exists."""
    hook = make_precompact_hook(memory_manager, "researcher")

    # Create a temp transcript file
    transcript = tmp_workspace / "transcript.jsonl"
    transcript.write_text('{"role": "assistant", "content": "hello"}\n')

    result = await hook(
        {"session_id": "test-session", "transcript_path": str(transcript)},
        tool_use_id=None,
        context=None,
    )

    assert result == {}
    # Verify archive was created
    conversations_dir = memory_manager.memory_dir / "conversations"
    archives = list(conversations_dir.glob("*.jsonl"))
    assert len(archives) == 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_precompact_flushes_observations(memory_manager):
    """PreCompact hook flushes mechanical observations to daily log."""
    hook = make_precompact_hook(memory_manager, "researcher")

    messages = [
        {"role": "assistant", "content": [
            {"type": "tool_use", "name": "supabase_query"},
            {"type": "text", "text": "Found 15 products with pricing below margin threshold. " + "x" * 50},
        ]},
    ]

    with patch("podclaw.hook_adapters._llm_extract_observations", side_effect=Exception("no LLM")):
        result = await hook(
            {"session_id": "test-session", "messages": messages},
            tool_use_id=None,
            context=None,
        )

    assert result == {}
    # Verify daily log was written
    daily_log = memory_manager.read_daily_tail(100)
    assert "PreCompact" in daily_log


@pytest.mark.asyncio
@pytest.mark.unit
async def test_precompact_llm_extraction(memory_manager):
    """PreCompact uses LLM extraction when available."""
    hook = make_precompact_hook(memory_manager, "researcher")

    messages = [
        {"role": "assistant", "content": [
            {"type": "text", "text": "Analyzed market trends and found significant opportunity in eco-friendly products"},
        ]},
    ]

    with patch("podclaw.hook_adapters._llm_extract_observations", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = "- Found eco-friendly product opportunity\n- Market growing 15% YoY"
        await hook(
            {"session_id": "test-session", "messages": messages},
            tool_use_id=None,
            context=None,
        )
        mock_llm.assert_called_once()

    daily_log = memory_manager.read_daily_tail(100)
    assert "eco-friendly" in daily_log


@pytest.mark.asyncio
@pytest.mark.unit
async def test_precompact_llm_fallback(memory_manager):
    """LLM extraction failure falls back to mechanical extraction."""
    hook = make_precompact_hook(memory_manager, "researcher")

    messages = [
        {"role": "assistant", "content": [
            {"type": "tool_use", "name": "supabase_query"},
            {"type": "text", "text": "Completed analysis of product data with interesting findings about trends. " + "x" * 50},
        ]},
    ]

    with patch("podclaw.hook_adapters._llm_extract_observations", new_callable=AsyncMock, side_effect=Exception("LLM unavailable")):
        await hook(
            {"session_id": "test-session", "messages": messages},
            tool_use_id=None,
            context=None,
        )

    # Should still have written via mechanical fallback
    daily_log = memory_manager.read_daily_tail(100)
    assert "Used 1 tools" in daily_log


# ---------------------------------------------------------------------------
# Stop and Failure hooks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_stop_hook_records_event():
    """Stop hook records agent_stop event."""
    es = MagicMock()
    es.record = AsyncMock()

    hook = make_stop_hook(es, "researcher", "session-123")
    await hook({"stop_hook_active": True}, tool_use_id=None, context=None)

    es.record.assert_called_once()
    call_kwargs = es.record.call_args.kwargs
    assert call_kwargs["event_type"] == "agent_stop"
    assert call_kwargs["agent_name"] == "researcher"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_failure_hook_records_event():
    """Failure hook records tool_failure event."""
    es = MagicMock()
    es.record = AsyncMock()

    hook = make_failure_hook(es, "designer", "session-456")
    await hook(
        {"tool_name": "fal_generate_image", "error": "API timeout", "is_interrupt": False},
        tool_use_id=None,
        context=None,
    )

    es.record.assert_called_once()
    call_kwargs = es.record.call_args.kwargs
    assert call_kwargs["event_type"] == "tool_failure"
    assert call_kwargs["payload"]["tool"] == "fal_generate_image"
