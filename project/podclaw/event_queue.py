"""
PodClaw — System Event Queue
===============================

Supabase-backed persistent queue for inter-agent communication.
Events survive process restarts and support lifecycle tracking
(pending → dispatched → completed → failed).

Agents push events; the heartbeat runner drains them each cycle.
Falls back to in-memory queue if Supabase is unavailable.
"""

from __future__ import annotations

import asyncio
import json
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class SystemEvent:
    """A single inter-agent event."""

    source: str  # agent_name | "cron" | "admin" | "hook"
    event_type: str  # "message" | "alert" | "dispatch_request" | "high_priority_action"
    payload: dict[str, Any]
    created_at: datetime
    wake_mode: str = "next-heartbeat"  # "now" | "next-heartbeat"
    target_agent: str | None = None
    db_id: int | None = None  # Supabase row ID (None if in-memory only)

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
    Persistent async-safe queue backed by Supabase `system_events` table.

    - Agents push events via hooks (PostToolUse) → inserted into DB
    - Heartbeat drains pending events → marks them as 'dispatched'
    - Events can be acknowledged (completed/failed) by handlers
    - Falls back to in-memory deque if Supabase is unavailable
    """

    MAX_MEMORY_SIZE = 200

    def __init__(self, supabase_client=None) -> None:
        self._supabase = supabase_client
        self._fallback: deque[SystemEvent] = deque(maxlen=self.MAX_MEMORY_SIZE)
        self._lock = asyncio.Lock()

    def set_supabase(self, client) -> None:
        """Set/update the Supabase client (for late initialization)."""
        self._supabase = client

    async def push(self, event: SystemEvent) -> bool:
        """Push an event. Persists to Supabase if available, else in-memory."""
        if self._supabase:
            return await self._push_db(event)
        return await self._push_memory(event)

    async def drain(self) -> list[SystemEvent]:
        """Drain all pending events. Marks DB events as 'dispatched'."""
        if self._supabase:
            return await self._drain_db()
        return await self._drain_memory()

    async def peek(self) -> list[SystemEvent]:
        """Return all pending events without removing them."""
        if self._supabase:
            return await self._peek_db()
        async with self._lock:
            return list(self._fallback)

    async def acknowledge(self, event: SystemEvent, status: str = "completed", handled_by: str = "") -> None:
        """Mark an event as completed or failed (DB only)."""
        if not self._supabase or not event.db_id:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            await asyncio.to_thread(
                lambda: self._supabase.from_("system_events")
                .update({"status": status, "completed_at": now, "handled_by": handled_by})
                .eq("id", event.db_id)
                .execute()
            )
        except Exception as e:
            logger.warning("event_acknowledge_failed", event_id=event.db_id, error=str(e))

    def has_urgent(self) -> bool:
        """Check if there are any urgent events (in-memory check only for speed)."""
        return any(e.wake_mode == "now" for e in self._fallback)

    @property
    def size(self) -> int:
        """Return in-memory queue size (fast, for health checks)."""
        return len(self._fallback)

    # -----------------------------------------------------------------------
    # Supabase persistence
    # -----------------------------------------------------------------------

    async def _push_db(self, event: SystemEvent) -> bool:
        """Insert event into system_events table."""
        try:
            row = {
                "source": event.source,
                "event_type": event.event_type,
                "payload": event.payload,
                "wake_mode": event.wake_mode,
                "target_agent": event.target_agent,
                "status": "pending",
            }
            result = await asyncio.to_thread(
                lambda: self._supabase.from_("system_events")
                .insert(row)
                .execute()
            )
            if result.data:
                event.db_id = result.data[0].get("id")
            logger.debug("event_pushed_db", source=event.source, type=event.event_type)

            # Mirror to in-memory for has_urgent() checks
            self._fallback.append(event)
            return True
        except Exception as e:
            logger.warning("event_push_db_failed_fallback", error=str(e))
            return await self._push_memory(event)

    async def _drain_db(self) -> list[SystemEvent]:
        """Fetch all pending events from DB and mark as dispatched."""
        try:
            now = datetime.now(timezone.utc).isoformat()

            # Fetch pending events
            result = await asyncio.to_thread(
                lambda: self._supabase.from_("system_events")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(50)
                .execute()
            )

            if not result.data:
                self._fallback.clear()
                return []

            events = []
            ids = []
            for row in result.data:
                evt = SystemEvent(
                    source=row["source"],
                    event_type=row["event_type"],
                    payload=row.get("payload", {}),
                    created_at=datetime.fromisoformat(row["created_at"]),
                    wake_mode=row.get("wake_mode", "next-heartbeat"),
                    target_agent=row.get("target_agent"),
                    db_id=row["id"],
                )
                events.append(evt)
                ids.append(row["id"])

            # Mark as dispatched
            if ids:
                await asyncio.to_thread(
                    lambda: self._supabase.from_("system_events")
                    .update({"status": "dispatched", "dispatched_at": now})
                    .in_("id", ids)
                    .execute()
                )

            self._fallback.clear()
            logger.info("events_drained_db", count=len(events))
            return events

        except Exception as e:
            logger.warning("event_drain_db_failed_fallback", error=str(e))
            return await self._drain_memory()

    async def _peek_db(self) -> list[SystemEvent]:
        """Peek at pending events from DB without marking them."""
        try:
            result = await asyncio.to_thread(
                lambda: self._supabase.from_("system_events")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(50)
                .execute()
            )
            if not result.data:
                return []

            return [
                SystemEvent(
                    source=row["source"],
                    event_type=row["event_type"],
                    payload=row.get("payload", {}),
                    created_at=datetime.fromisoformat(row["created_at"]),
                    wake_mode=row.get("wake_mode", "next-heartbeat"),
                    target_agent=row.get("target_agent"),
                    db_id=row["id"],
                )
                for row in result.data
            ]
        except Exception as e:
            logger.warning("event_peek_db_failed", error=str(e))
            return list(self._fallback)

    # -----------------------------------------------------------------------
    # In-memory fallback
    # -----------------------------------------------------------------------

    async def _push_memory(self, event: SystemEvent) -> bool:
        async with self._lock:
            was_full = len(self._fallback) >= self.MAX_MEMORY_SIZE
            if was_full:
                evicted = self._fallback[0]
                logger.warning(
                    "event_queue_overflow",
                    evicted_source=evicted.source,
                    evicted_type=evicted.event_type,
                    new_source=event.source,
                    new_type=event.event_type,
                )
            self._fallback.append(event)
            return not was_full

    async def _drain_memory(self) -> list[SystemEvent]:
        async with self._lock:
            events = list(self._fallback)
            self._fallback.clear()
            return events
