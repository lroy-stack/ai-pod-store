"""
PodClaw — Event Log Hook (PostToolUse)
========================================

Records every tool call as an immutable event in the agent_events table.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

import structlog

from podclaw.event_store import EventStore

logger = structlog.get_logger(__name__)


def event_log_hook(event_store: EventStore) -> Callable:
    """
    Factory: creates a PostToolUse hook bound to an EventStore instance.
    """

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_output = input_data.get("tool_output", "")
        agent_name = input_data.get("_agent_name", "unknown")
        session_id = input_data.get("_session_id")

        # Record as event (truncate large outputs)
        await event_store.record(
            agent_name=agent_name,
            event_type="tool_call",
            payload={
                "tool": tool_name,
                "input_keys": list(tool_input.keys()) if isinstance(tool_input, dict) else [],
                "output_length": len(str(tool_output)),
                "success": not input_data.get("_error"),
            },
            session_id=session_id,
        )

        return {}

    return _hook
