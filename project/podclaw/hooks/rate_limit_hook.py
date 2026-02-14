"""
PodClaw — Rate Limit Hook (PreToolUse)
========================================

Enforces per-tool rate limits per agent cycle.
Limits reset when a new agent session starts.

Rate limits are per-session (not per-day), so in-memory tracking is correct.
The Supabase client is used to log rate limit violations for auditing.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import structlog

from podclaw.config import RATE_LIMITS

logger = structlog.get_logger(__name__)

# In-memory counter: {agent_name: {tool_name: count}}
_counters: dict[str, dict[str, int]] = {}

# Optional Supabase client for audit logging
_supabase_client: Any = None


def init_rate_limit(supabase_client: Any) -> None:
    """Initialize with Supabase client for audit logging."""
    global _supabase_client
    _supabase_client = supabase_client


async def rate_limit_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """
    PreToolUse hook: enforce per-tool rate limits per agent.
    """
    tool_name = input_data.get("tool_name", "")
    agent_name = input_data.get("_agent_name", "unknown")

    # Get limits for this agent
    limits = RATE_LIMITS.get(agent_name, {})
    limit = limits.get(tool_name)

    if limit is None:
        return {}  # No limit for this tool/agent combo

    # Check counter
    if agent_name not in _counters:
        _counters[agent_name] = {}

    current = _counters[agent_name].get(tool_name, 0)

    if current >= limit:
        reason = (
            f"Rate limit exceeded for '{agent_name}': "
            f"{tool_name} called {current}/{limit} times this cycle"
        )
        logger.warning("rate_limit_exceeded", agent=agent_name, tool=tool_name, count=current, limit=limit)

        # Audit log to Supabase (non-blocking)
        if _supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: _supabase_client.table("agent_events").insert({
                        "agent_name": agent_name,
                        "event_type": "rate_limit_exceeded",
                        "payload": {"tool": tool_name, "count": current, "limit": limit},
                    }).execute()
                )
            except Exception:
                pass  # Don't fail the hook on audit log errors

        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }

    # Increment counter
    _counters[agent_name][tool_name] = current + 1
    return {}


def reset_counters(agent_name: str | None = None) -> None:
    """Reset rate limit counters. If agent_name given, reset only that agent."""
    if agent_name:
        _counters.pop(agent_name, None)
    else:
        _counters.clear()


def get_counters() -> dict[str, dict[str, int]]:
    """Get current rate limit counters."""
    return dict(_counters)
