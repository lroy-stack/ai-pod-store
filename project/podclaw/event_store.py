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

_SUPABASE_TIMEOUT = 30.0  # seconds — prevent thread pool hangs


async def _supabase_call(fn, timeout: float = _SUPABASE_TIMEOUT):
    """Run a sync Supabase call in a thread pool with timeout."""
    return await asyncio.wait_for(asyncio.to_thread(fn), timeout=timeout)


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
        await _supabase_call(
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

        result = await _supabase_call(_run_query)
        return result.data if result.data else []

    async def query_sessions(
        self,
        agent_name: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Query agent_sessions table."""
        if not self._client:
            return []

        def _run_query():
            q = self._client.table("agent_sessions").select("*")
            if agent_name:
                q = q.eq("session_type", agent_name)
            q = q.order("started_at", desc=True).limit(limit)
            return q.execute()

        result = await _supabase_call(_run_query)
        return result.data if result.data else []

    async def record_session(
        self,
        session_id: str,
        session_type: str,
        status: str = "running",
    ) -> None:
        """Insert a new session record into agent_sessions."""
        if not self._client:
            return

        row = {
            "id": session_id,
            "session_type": session_type,
            "status": status,
        }

        try:
            await _supabase_call(
                lambda: self._client.table("agent_sessions").insert(row).execute()
            )
        except asyncio.TimeoutError:
            logger.error("session_insert_timeout", session_id=session_id)
        except Exception as e:
            logger.error("session_insert_failed", error=str(e), session_id=session_id)

    async def update_session(
        self,
        session_id: str,
        status: str,
        tool_calls: int = 0,
        tool_errors: int = 0,
        error_log: str | None = None,
    ) -> None:
        """Update a session record (on completion/error)."""
        if not self._client:
            return

        from datetime import datetime, timezone
        updates: dict[str, Any] = {
            "status": status,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "tool_calls": tool_calls,
            "tool_errors": tool_errors,
        }
        if error_log:
            updates["error_log"] = error_log

        try:
            await _supabase_call(
                lambda: (
                    self._client.table("agent_sessions")
                    .update(updates)
                    .eq("id", session_id)
                    .execute()
                )
            )
        except asyncio.TimeoutError:
            logger.error("session_update_timeout", session_id=session_id)
        except Exception as e:
            logger.error("session_update_failed", error=str(e), session_id=session_id)

    async def record_audit(
        self,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        changes: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Record an action to the audit_log table."""
        if not self._client:
            return

        row = {
            "actor_type": "ai_agent",
            "actor_id": actor_id,
            "action": action,
            "resource_type": resource_type,
            "changes": changes or {},
            "metadata": metadata or {},
        }
        if resource_id:
            row["resource_id"] = resource_id

        try:
            await _supabase_call(
                lambda: self._client.table("audit_log").insert(row).execute()
            )
        except asyncio.TimeoutError:
            logger.error("audit_log_timeout", action=action)
        except Exception as e:
            logger.error("audit_log_failed", error=str(e), action=action)

    async def get_session_events(self, session_id: str) -> list[dict[str, Any]]:
        """Get all events for a specific session."""
        if not self._client:
            return []
        result = await _supabase_call(
            lambda: (
                self._client.table("agent_events")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at")
                .execute()
            )
        )
        return result.data if result.data else []
