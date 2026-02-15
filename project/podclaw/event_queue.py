"""
PodClaw — System Event Queue
===============================

Bounded in-memory queue for inter-agent communication.
Agents push events; the heartbeat runner drains them each cycle.
"""

from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SystemEvent:
    """A single inter-agent event."""

    source: str  # agent_name | "cron" | "admin" | "hook"
    event_type: str  # "message" | "alert" | "dispatch_request" | "high_priority_action"
    payload: dict[str, Any]
    created_at: datetime
    wake_mode: str = "next-heartbeat"  # "now" | "next-heartbeat"
    target_agent: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "event_type": self.event_type,
            "payload": self.payload,
            "created_at": self.created_at.isoformat(),
            "wake_mode": self.wake_mode,
            "target_agent": self.target_agent,
        }


class SystemEventQueue:
    """
    Bounded async-safe queue (max 20 events) for inter-agent communication.

    - Agents push events via hooks (PostToolUse)
    - Heartbeat drains all events each cycle
    - Admin can push events via bridge API
    """

    MAX_SIZE = 20

    def __init__(self) -> None:
        self._queue: deque[SystemEvent] = deque(maxlen=self.MAX_SIZE)
        self._lock = asyncio.Lock()

    async def push(self, event: SystemEvent) -> bool:
        """
        Push an event to the queue.
        Returns True if added, False if queue is full (oldest was evicted).
        """
        async with self._lock:
            was_full = len(self._queue) >= self.MAX_SIZE
            self._queue.append(event)
            return not was_full

    async def drain(self) -> list[SystemEvent]:
        """Drain all events from the queue (atomic). Returns list of events."""
        async with self._lock:
            events = list(self._queue)
            self._queue.clear()
            return events

    async def peek(self) -> list[SystemEvent]:
        """Return a copy of all events without removing them."""
        async with self._lock:
            return list(self._queue)

    def has_urgent(self) -> bool:
        """Check if there are any events with wake_mode='now'."""
        return any(e.wake_mode == "now" for e in self._queue)

    @property
    def size(self) -> int:
        return len(self._queue)
