"""
PodClaw — Rate Limit Hook (PreToolUse)
========================================

Enforces per-tool rate limits per agent per day.
Limits are stored in Redis and persist across PodClaw restarts.

Rate limits use Redis HASH with pattern: podclaw:rate:{agent}:{date}
The Supabase client is used to log rate limit violations for auditing.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import structlog

from podclaw.config import RATE_LIMITS
from podclaw.redis_store import increment_rate_limit, get_rate_limit, reset_rate_limits, init_redis

logger = structlog.get_logger(__name__)

# Optional Supabase client for audit logging
_supabase_client: Any = None


def init_rate_limit(supabase_client: Any) -> None:
    """Initialize with Supabase client for audit logging and Redis."""
    global _supabase_client
    _supabase_client = supabase_client
    init_redis()  # Initialize Redis connection pool


async def rate_limit_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """
    PreToolUse hook: enforce per-tool rate limits per agent per day.
    Uses Redis HASH for persistent, atomic counters.
    """
    tool_name = input_data.get("tool_name", "")
    agent_name = input_data.get("_agent_name", "unknown")

    # Get limits for this agent
    limits = RATE_LIMITS.get(agent_name, {})
    limit = limits.get(tool_name)

    if limit is None:
        return {}  # No limit for this tool/agent combo

    # Get current count from Redis
    current = await get_rate_limit(agent_name, tool_name)

    if current >= limit:
        reason = (
            f"Rate limit exceeded for '{agent_name}': "
            f"{tool_name} called {current}/{limit} times today"
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

    # Increment counter in Redis
    new_count = await increment_rate_limit(agent_name, tool_name)
    logger.debug("rate_limit_tracked", agent=agent_name, tool=tool_name, count=new_count, limit=limit)

    return {}


async def reset_counters(agent_name: str | None = None) -> None:
    """Reset rate limit counters in Redis. If agent_name given, reset only that agent."""
    await reset_rate_limits(agent_name)


async def get_counters() -> dict[str, dict[str, int]]:
    """
    Get current rate limit counters from Redis.

    Returns empty dict (not implemented - use Redis CLI to inspect).
    """
    # Not implemented: would require scanning all Redis keys matching podclaw:rate:*:*
    # Use Redis CLI instead: redis-cli --scan --pattern "podclaw:rate:*:*"
    logger.warning("get_counters_not_implemented", reason="Use Redis CLI to inspect rate limits")
    return {}
