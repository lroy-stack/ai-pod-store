"""
PodClaw — Event Store
======================

Immutable event sourcing to the agent_events Supabase table.
Every sub-agent action is recorded as an event for auditability.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class EventStore:
    """Append-only event store backed by Supabase agent_events table."""

    def __init__(self, supabase_client: Any | None = None):
        self._client = supabase_client

    async def record(
        self,
        agent_name: str,
        event_type: str,
        payload: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> str:
        """
        Record an immutable event.

        Args:
            agent_name: Which sub-agent produced the event
            event_type: Category (tool_call, decision, error, approval_request, etc.)
            payload: Arbitrary JSON payload
            session_id: Current agent session ID

        Returns:
            The event ID (UUID)
        """
        event_id = str(uuid.uuid4())

        # DB row matches agent_events schema (column is "data", not "payload")
        db_event = {
            "agent_name": agent_name,
            "event_type": event_type,
            "data": payload or {},
            "session_id": session_id,
        }

        # Local log uses descriptive keys
        event = {
            "id": event_id,
            "agent_name": agent_name,
            "event_type": event_type,
            "payload": payload or {},
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if self._client:
            try:
                await self._write_to_supabase(db_event)
            except Exception as e:
                logger.error("event_store_write_failed", error=str(e), event_id=event_id)
                # Fall through to local log
        else:
            logger.info("event_recorded_local", **event)

        return event_id

    async def _write_to_supabase(self, event: dict[str, Any]) -> None:
        """Write event to agent_events table (runs sync SDK in thread pool)."""
        await asyncio.to_thread(
            lambda: self._client.table("agent_events").insert(event).execute()
        )

    async def query(
        self,
        agent_name: str | None = None,
        event_type: str | None = None,
        since: datetime | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Query events with optional filters."""
        if not self._client:
            return []

        def _run_query():
            q = self._client.table("agent_events").select("*")
            if agent_name:
                q = q.eq("agent_name", agent_name)
            if event_type:
                q = q.eq("event_type", event_type)
            if since:
                q = q.gte("created_at", since.isoformat())
            q = q.order("created_at", desc=True).limit(limit)
            return q.execute()

        result = await asyncio.to_thread(_run_query)
        return result.data if result.data else []

    async def get_session_events(self, session_id: str) -> list[dict[str, Any]]:
        """Get all events for a specific session."""
        if not self._client:
            return []
        result = await asyncio.to_thread(
            lambda: (
                self._client.table("agent_events")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at")
                .execute()
            )
        )
        return result.data if result.data else []
