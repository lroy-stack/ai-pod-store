"""
PodClaw — Memory Hook (PostToolUse)
=====================================

Appends action summaries to today's daily memory log.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

import structlog

from podclaw.memory_manager import MemoryManager

logger = structlog.get_logger(__name__)


def memory_hook(memory_manager: MemoryManager) -> Callable:
    """
    Factory: creates a PostToolUse hook bound to a MemoryManager instance.
    """

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")
        agent_name = input_data.get("_agent_name", "unknown")
        tool_input = input_data.get("tool_input", {})

        # Only log significant actions (skip reads)
        significant_tools = {
            "supabase_insert", "supabase_update",
            "stripe_create_refund",
            "printify_create", "printify_update", "printify_publish",
            "fal_generate",
            "resend_send", "resend_send_batch",
            "telegram_send", "telegram_broadcast",
            "whatsapp_send", "whatsapp_send_template",
        }

        if tool_name in significant_tools:
            summary = f"- {tool_name}: "
            if isinstance(tool_input, dict):
                # Summarize key fields
                if "table" in tool_input:
                    summary += f"table={tool_input['table']} "
                if "data" in tool_input and isinstance(tool_input["data"], dict):
                    summary += f"fields={list(tool_input['data'].keys())[:5]}"
                else:
                    summary += f"input_keys={list(tool_input.keys())[:5]}"
            await memory_manager.append_daily(agent_name, summary)

        return {}

    return _hook
