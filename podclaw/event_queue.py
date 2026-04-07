"""
PodClaw — System Event Queue
===============================

Redis LIST-backed persistent queue for inter-agent communication.
Events survive process restarts via Redis LPUSH/BRPOP pattern.

Priority order:
  1. Redis LIST  — primary (LPUSH/BRPOP, survives restarts)
  2. Supabase    — secondary persistence (system_events table)
  3. In-memory   — last resort deque fallback

Dead-letter queue:
  Failed events are moved to `podclaw:events:dlq` Redis LIST.
  Items in DLQ expire after 7 days.

Key patterns:
  podclaw:events:queue  — main event queue (LIST)
  podclaw:events:dlq    — dead-letter queue (LIST)
"""

from __future__ import annotations

import asyncio
import json
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

_SUPABASE_TIMEOUT = 30.0  # seconds — prevent thread pool hangs


async def _supabase_call(fn, timeout: float = _SUPABASE_TIMEOUT):
    """Run a sync Supabase call in a thread pool with timeout."""
    return await asyncio.wait_for(asyncio.to_thread(fn), timeout=timeout)


# Redis key constants
REDIS_QUEUE_KEY = "podclaw:events:queue"
REDIS_DLQ_KEY = "podclaw:events:dlq"
REDIS_QUEUE_TTL = 86400 * 7  # 7 days


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
    retry_count: int = 0  # Track retries for DLQ routing

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "event_type": self.event_type,
            "payload": self.payload,
            "created_at": self.created_at.isoformat(),
            "wake_mode": self.wake_mode,
            "target_agent": self.target_agent,
            "retry_count": self.retry_count,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SystemEvent":
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError:
                created_at = datetime.now(timezone.utc)
        elif not isinstance(created_at, datetime):
            created_at = datetime.now(timezone.utc)

        return cls(
            source=data.get("source", "unknown"),
            event_type=data.get("event_type", "unknown"),
            payload=data.get("payload", {}),
            created_at=created_at,
            wake_mode=data.get("wake_mode", "next-heartbeat"),
            target_agent=data.get("target_agent"),
            db_id=data.get("db_id"),
            retry_count=data.get("retry_count", 0),
        )


class SystemEventQueue:
    """
    Redis LIST-backed async-safe event queue with Supabase + in-memory fallback.

    Push:  LPUSH podclaw:events:queue  (newest at head)
    Drain: LRANGE + DEL               (atomic read-all-and-clear)
    DLQ:   LPUSH podclaw:events:dlq   (failed events, 7-day TTL)

    Falls back to Supabase system_events table when Redis unavailable.
    Falls back to in-memory deque when both are unavailable.
    """

    MAX_MEMORY_SIZE = 200
    MAX_RETRIES = 3  # Events failing > MAX_RETRIES go to DLQ

    def __init__(self, supabase_client=None, redis_client=None) -> None:
        self._supabase = supabase_client
        self._redis = redis_client
        self._fallback: deque[SystemEvent] = deque(maxlen=self.MAX_MEMORY_SIZE)
        self._lock = asyncio.Lock()

    def set_supabase(self, client) -> None:
        """Set/update the Supabase client (for late initialization)."""
        self._supabase = client

    def set_redis(self, client) -> None:
        """Set/update the Redis client (for late initialization)."""
        self._redis = client

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    async def push(self, event: SystemEvent) -> bool:
        """
        Push an event to the queue.

        Priority: Redis LIST → Supabase → in-memory
        """
        if self._redis:
            return await self._push_redis(event)
        if self._supabase:
            return await self._push_db(event)
        return await self._push_memory(event)

    async def drain(self) -> list[SystemEvent]:
        """
        Drain all pending events. Returns them in FIFO order.

        Priority: Redis LIST → Supabase → in-memory
        """
        if self._redis:
            return await self._drain_redis()
        if self._supabase:
            return await self._drain_db()
        return await self._drain_memory()

    async def peek(self) -> list[SystemEvent]:
        """Return all pending events without removing them."""
        if self._redis:
            return await self._peek_redis()
        if self._supabase:
            return await self._peek_db()
        async with self._lock:
            return list(self._fallback)

    async def acknowledge(self, event: SystemEvent, status: str = "completed", handled_by: str = "") -> None:
        """Mark an event as completed or failed (Supabase only)."""
        if not self._supabase or not event.db_id:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            await _supabase_call(
                lambda: self._supabase.from_("system_events")
                .update({"status": status, "completed_at": now, "handled_by": handled_by})
                .eq("id", event.db_id)
                .execute()
            )
        except Exception as e:
            logger.warning("event_acknowledge_failed", event_id=event.db_id, error=str(e))

    async def send_to_dlq(self, event: SystemEvent, reason: str = "") -> None:
        """
        Move a failed event to the dead-letter queue.

        DLQ key: podclaw:events:dlq (Redis LIST, 7-day TTL)
        Falls back to logging if Redis unavailable.
        """
        if not self._redis:
            logger.error(
                "event_dlq_no_redis",
                source=event.source,
                event_type=event.event_type,
                reason=reason,
            )
            return

        try:
            dlq_entry = {
                **event.to_dict(),
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "failure_reason": reason,
            }
            serialized = json.dumps(dlq_entry)
            await self._redis.lpush(REDIS_DLQ_KEY, serialized)
            await self._redis.expire(REDIS_DLQ_KEY, REDIS_QUEUE_TTL)
            logger.warning(
                "event_sent_to_dlq",
                source=event.source,
                event_type=event.event_type,
                reason=reason,
                retry_count=event.retry_count,
            )
        except Exception as e:
            logger.error("event_dlq_push_failed", error=str(e))

    async def peek_dlq(self) -> list[dict]:
        """Return all events in the dead-letter queue (for monitoring)."""
        if not self._redis:
            return []
        try:
            items = await self._redis.lrange(REDIS_DLQ_KEY, 0, -1)
            result = []
            for item in items:
                try:
                    result.append(json.loads(item))
                except json.JSONDecodeError:
                    pass
            return result
        except Exception as e:
            logger.warning("event_dlq_peek_failed", error=str(e))
            return []

    async def retry_or_dlq(self, event: SystemEvent, reason: str = "") -> None:
        """
        Increment retry count. If over MAX_RETRIES, send to DLQ.
        Otherwise, re-push to queue for retry.
        """
        event.retry_count += 1
        if event.retry_count > self.MAX_RETRIES:
            await self.send_to_dlq(event, reason=reason)
        else:
            logger.info(
                "event_retry",
                source=event.source,
                event_type=event.event_type,
                retry_count=event.retry_count,
            )
            await self.push(event)

    def has_urgent(self) -> bool:
        """Check if there are any urgent events (in-memory check only for speed)."""
        return any(e.wake_mode == "now" for e in self._fallback)

    @property
    def size(self) -> int:
        """Return in-memory queue size (fast, for health checks)."""
        return len(self._fallback)

    # -----------------------------------------------------------------------
    # Redis LIST operations (primary)
    # -----------------------------------------------------------------------

    async def _push_redis(self, event: SystemEvent) -> bool:
        """Push event to Redis LIST using LPUSH (newest at head)."""
        try:
            serialized = json.dumps(event.to_dict())
            await self._redis.lpush(REDIS_QUEUE_KEY, serialized)
            # Refresh TTL on each push (sliding window)
            await self._redis.expire(REDIS_QUEUE_KEY, REDIS_QUEUE_TTL)
            logger.debug("event_pushed_redis", source=event.source, type=event.event_type)
            # Mirror to in-memory for has_urgent() checks
            self._fallback.append(event)
            return True
        except Exception as e:
            logger.warning("event_push_redis_failed_fallback", error=str(e))
            # Fall through to Supabase
            if self._supabase:
                return await self._push_db(event)
            return await self._push_memory(event)

    async def _drain_redis(self) -> list[SystemEvent]:
        """
        Drain all events from Redis LIST using LRANGE + DEL.
        Returns events in FIFO order (LRANGE returns newest-first, so we reverse).
        """
        try:
            # Atomic: get all items then delete
            pipe = self._redis.pipeline()
            pipe.lrange(REDIS_QUEUE_KEY, 0, -1)
            pipe.delete(REDIS_QUEUE_KEY)
            results = await pipe.execute()

            items = results[0] if results else []
            if not items:
                self._fallback.clear()
                return []

            # Items are newest-first (LPUSH), reverse for FIFO
            events = []
            for item in reversed(items):
                try:
                    data = json.loads(item)
                    events.append(SystemEvent.from_dict(data))
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("event_parse_failed_redis", item=str(item)[:100], error=str(e))

            self._fallback.clear()
            logger.info("events_drained_redis", count=len(events))
            return events

        except Exception as e:
            logger.warning("event_drain_redis_failed_fallback", error=str(e))
            if self._supabase:
                return await self._drain_db()
            return await self._drain_memory()

    async def _peek_redis(self) -> list[SystemEvent]:
        """Peek at events in Redis LIST without removing them."""
        try:
            items = await self._redis.lrange(REDIS_QUEUE_KEY, 0, -1)
            if not items:
                return []

            # Reverse for FIFO order
            events = []
            for item in reversed(items):
                try:
                    data = json.loads(item)
                    events.append(SystemEvent.from_dict(data))
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("event_parse_failed_redis_peek", error=str(e))

            return events
        except Exception as e:
            logger.warning("event_peek_redis_failed", error=str(e))
            return list(self._fallback)

    # -----------------------------------------------------------------------
    # Supabase persistence (secondary)
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
            result = await _supabase_call(
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
            result = await _supabase_call(
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
                await _supabase_call(
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
            result = await _supabase_call(
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
    # In-memory fallback (last resort)
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
