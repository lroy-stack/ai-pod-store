# Copyright (c) 2026 L.LOWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Context Loader
===========================

Standalone context enrichment for scheduled and heartbeat tasks.
Extracts cognitive context (SOUL, MEMORY, daily log) and wraps task
messages with source-aware prefixes.

No class dependency — pure functions operating on MemoryManager.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from podclaw.memory_manager import MemoryManager


def parse_source(source: str) -> tuple[str | None, str | None]:
    """Parse source string into (agent_name, task_key).

    Examples:
        "cron:researcher"            -> ("researcher", "researcher")
        "cron:cataloger:pricing"     -> ("cataloger", "cataloger_pricing")
        "heartbeat:researcher"       -> ("researcher", "researcher")
    """
    parts = source.split(":")
    if len(parts) < 2:
        return None, None

    prefix = parts[0]
    agent_name = parts[1]

    if prefix == "ceo" and len(parts) >= 3:
        agent_name = parts[2]
        task_key = agent_name
    elif len(parts) >= 3:
        suffix = parts[2]
        task_key = f"{agent_name}_{suffix}"
    else:
        task_key = agent_name

    return agent_name, task_key


def load_context(memory: "MemoryManager") -> str:
    """Load SOUL, MEMORY, and daily activity as compact context block.

    Lightweight reads only — no LLM calls, no network.
    """
    parts = []

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    parts.append(f"Timestamp: {now}")

    try:
        soul = memory.read_soul()
        if soul:
            parts.append(f"SOUL: {soul[:500]}")
    except Exception:
        pass

    try:
        mem = memory.read_memory()
        if mem:
            parts.append(f"MEMORY: {mem[:500]}")
    except Exception:
        pass

    try:
        daily_path = memory._daily_log_path()
        if daily_path.exists():
            daily = daily_path.read_text()
            if daily:
                parts.append(f"TODAY: {daily[-500:]}")
    except Exception:
        pass

    return "\n".join(parts)


def build_cognitive_task(
    source: str,
    message: str,
    memory: "MemoryManager",
) -> str:
    """Enrich a task message with cognitive context from SOUL, MEMORY, and daily log.

    Args:
        source: Event source string (e.g. "cron:researcher", "heartbeat:finance")
        message: The task description or CEO message
        memory: MemoryManager instance for file reads

    Returns:
        Enriched task string with source prefix and context block.
    """
    context = load_context(memory)

    if source.startswith("cron:"):
        return (
            f"[SCHEDULED TASK]\n"
            f"{message}\n\n"
            f"[CONTEXT]\n"
            f"{context}"
        )

    if source.startswith("heartbeat:"):
        return (
            f"[HEARTBEAT DISPATCH]\n"
            f"{message}\n\n"
            f"[CONTEXT]\n"
            f"{context}"
        )

    # Fallback
    return f"{message}\n\n[CONTEXT]\n{context}"
