"""
PodClaw — Memory Hook (PostToolUse)
=====================================

Appends action summaries to today's daily memory log.
Optionally pushes high-priority actions to the heartbeat event queue.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Optional

import structlog

from podclaw.memory_manager import MemoryManager

logger = structlog.get_logger(__name__)


def memory_hook(memory_manager: MemoryManager, event_queue=None) -> Callable:
    """
    Factory: creates a PostToolUse hook bound to a MemoryManager instance.

    Args:
        memory_manager: The memory manager for daily log appends
        event_queue: Optional SystemEventQueue for heartbeat integration
    """

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")
        agent_name = input_data.get("_agent_name", "unknown")
        tool_input = input_data.get("tool_input", {})

        # Only log high-level events to daily memory (individual tool calls
        # are already tracked in agent_events table via event_log_hook).
        # This keeps daily logs at ~30-50 entries instead of ~400.
        HIGH_LEVEL_TOOLS = {
            "stripe_create_refund",
            "printful_delete_product",
            "resend_send_batch",
            "telegram_broadcast",
        }

        if tool_name in HIGH_LEVEL_TOOLS:
            summary = f"- {tool_name}: "
            if isinstance(tool_input, dict):
                if "table" in tool_input:
                    summary += f"table={tool_input['table']} "
                else:
                    summary += f"input_keys={list(tool_input.keys())[:5]}"
            await memory_manager.append_daily(agent_name, summary)

        # Push high-priority actions to heartbeat event queue
        HIGH_PRIORITY_TOOLS = {"stripe_create_refund", "printful_delete_product"}
        if event_queue and tool_name in HIGH_PRIORITY_TOOLS:
            from podclaw.event_queue import SystemEvent
            await event_queue.push(SystemEvent(
                source=agent_name,
                event_type="high_priority_action",
                payload={"tool": tool_name, "input_keys": list(tool_input.keys())[:5]},
                created_at=datetime.now(timezone.utc),
                wake_mode="next-heartbeat",
            ))

        # Detect URGENT pricing alerts written by Finance to pricing_history.md
        if event_queue and agent_name == "finance" and tool_name == "Write":
            file_path = tool_input.get("file_path", "")
            if "pricing_history" in file_path:
                content = str(tool_input.get("content", ""))
                if "URGENT" in content or "NEGATIVE_MARGIN" in content:
                    from podclaw.event_queue import SystemEvent
                    await event_queue.push(SystemEvent(
                        source="finance",
                        event_type="pricing_negative_margin",
                        payload={"trigger": "urgent_pricing_alert"},
                        created_at=datetime.now(timezone.utc),
                        wake_mode="now",
                        target_agent="cataloger",
                    ))

        # Detect zombie products written by Finance to product_scorecard.md
        if event_queue and agent_name == "finance" and tool_name == "Write":
            file_path = tool_input.get("file_path", "")
            if "product_scorecard" in file_path:
                content = str(tool_input.get("content", ""))
                if "ZOMBIE" in content:
                    # Count zombie mentions for severity
                    zombie_count = content.upper().count("ZOMBIE")
                    from podclaw.event_queue import SystemEvent
                    await event_queue.push(SystemEvent(
                        source="finance",
                        event_type="zombie_products_detected",
                        payload={
                            "trigger": "product_scorecard_zombies",
                            "zombie_count": zombie_count,
                        },
                        created_at=datetime.now(timezone.utc),
                        wake_mode="next-heartbeat",
                    ))

        return {}

    return _hook
