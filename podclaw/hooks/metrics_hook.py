"""
PodClaw — Metrics Hook (PreToolUse + PostToolUse)
===================================================

Tracks tool_calls, tool_errors, and latency per agent.
Uses a PreToolUse hook to record start time and PostToolUse to calculate delta.
"""

from __future__ import annotations

import time
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

# In-memory metrics: {agent_name: {tool_calls, tool_errors, total_latency_ms}}
_metrics: dict[str, dict[str, float]] = {}

# Pending tool timers: {tool_use_id: start_monotonic}
_pending_timers: dict[str, float] = {}


async def metrics_pre_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """PreToolUse hook: record start time for latency tracking."""
    if tool_use_id:
        _pending_timers[tool_use_id] = time.monotonic()
    return {}


async def metrics_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """PostToolUse hook: track tool calls, errors, and latency."""
    agent_name = input_data.get("_agent_name", "unknown")
    is_error = bool(input_data.get("_error") or input_data.get("is_error"))

    # Calculate latency from pending timer
    latency_ms = 0.0
    if tool_use_id and tool_use_id in _pending_timers:
        latency_ms = (time.monotonic() - _pending_timers.pop(tool_use_id)) * 1000

    if agent_name not in _metrics:
        _metrics[agent_name] = {"tool_calls": 0, "tool_errors": 0, "total_latency_ms": 0}

    _metrics[agent_name]["tool_calls"] += 1
    if is_error:
        _metrics[agent_name]["tool_errors"] += 1
    _metrics[agent_name]["total_latency_ms"] += latency_ms

    return {}


def get_metrics() -> dict[str, dict[str, float]]:
    """Get current metrics for all agents."""
    return dict(_metrics)


def get_agent_metrics(agent_name: str) -> dict[str, float]:
    """Get metrics for a specific agent."""
    return dict(_metrics.get(agent_name, {"tool_calls": 0, "tool_errors": 0, "total_latency_ms": 0}))


def reset_metrics(agent_name: str | None = None) -> None:
    """Reset metrics. If agent_name given, reset only that agent."""
    if agent_name:
        _metrics.pop(agent_name, None)
    else:
        _metrics.clear()
    _pending_timers.clear()
