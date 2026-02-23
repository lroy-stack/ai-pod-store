"""
PodClaw — Async Delegation Subsystem
======================================

Provides non-blocking delegation of sub-agent tasks during chat sessions.

Flow:
1. delegate_connector enqueues a DelegationRequest (status=pending)
2. DelegationWorker picks it up in background → runs orchestrator.run_agent()
3. Result persists in StateStore (status=completed|failed)
4. Next chat turn: ChatSession checks pending_announces() → injects [DATA] DELEGATION RESULTS
5. PodClaw responds naturally with the delegation outcome
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from podclaw.state_store import StateStore

logger = structlog.get_logger(__name__)

_KEY_PREFIX = "delegation:"


@dataclass
class DelegationRequest:
    """A single delegation of work to a sub-agent."""

    id: str
    conversation_id: str
    agent_name: str
    task: str
    reason: str
    status: str  # pending | running | completed | failed | announced
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    result: dict | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> DelegationRequest:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class DelegationRegistry:
    """StateStore-backed registry for tracking async delegations."""

    def __init__(self, state_store: StateStore):
        self._state = state_store

    def _key(self, delegation_id: str) -> str:
        return f"{_KEY_PREFIX}{delegation_id}"

    async def register(self, req: DelegationRequest) -> None:
        """Persist a new delegation request."""
        await self._state.set(self._key(req.id), req.to_dict())
        logger.info(
            "delegation_registered",
            delegation_id=req.id,
            agent=req.agent_name,
            conversation_id=req.conversation_id,
        )

    async def update_status(
        self,
        delegation_id: str,
        status: str,
        *,
        result: dict | None = None,
        error: str | None = None,
    ) -> None:
        """Update status (and optionally result/error) of an existing delegation."""
        data = await self._state.get(self._key(delegation_id))
        if not data:
            logger.warning("delegation_not_found", delegation_id=delegation_id)
            return

        data["status"] = status
        now = datetime.now(timezone.utc).isoformat()

        if status == "running":
            data["started_at"] = now
        elif status in ("completed", "failed"):
            data["completed_at"] = now

        if result is not None:
            data["result"] = result
        if error is not None:
            data["error"] = error

        await self._state.set(self._key(delegation_id), data)
        logger.info("delegation_status_updated", delegation_id=delegation_id, status=status)

    async def get(self, delegation_id: str) -> DelegationRequest | None:
        """Load a single delegation by ID."""
        data = await self._state.get(self._key(delegation_id))
        if not data:
            return None
        return DelegationRequest.from_dict(data)

    async def pending_announces(self, conversation_id: str) -> list[DelegationRequest]:
        """Return completed/failed delegations for a conversation that haven't been announced."""
        all_keys = await self._state.keys()
        delegation_keys = [k for k in all_keys if k.startswith(_KEY_PREFIX)]

        results: list[DelegationRequest] = []
        for key in delegation_keys:
            data = await self._state.get(key)
            if not data:
                continue
            if data.get("conversation_id") != conversation_id:
                continue
            if data.get("status") not in ("completed", "failed"):
                continue
            results.append(DelegationRequest.from_dict(data))

        # Sort by completion time (oldest first)
        results.sort(key=lambda r: r.completed_at or "")
        return results

    async def mark_announced(self, delegation_id: str) -> None:
        """Mark a delegation as announced (terminal state)."""
        await self.update_status(delegation_id, "announced")

    async def pending_work(self) -> list[DelegationRequest]:
        """Return all delegations with status=pending (for the worker to pick up)."""
        all_keys = await self._state.keys()
        delegation_keys = [k for k in all_keys if k.startswith(_KEY_PREFIX)]

        results: list[DelegationRequest] = []
        for key in delegation_keys:
            data = await self._state.get(key)
            if not data:
                continue
            if data.get("status") != "pending":
                continue
            results.append(DelegationRequest.from_dict(data))

        # FIFO — oldest first
        results.sort(key=lambda r: r.created_at)
        return results

    async def cleanup_old(self, max_age_hours: int = 24) -> int:
        """Remove announced/failed delegations older than max_age_hours."""
        all_keys = await self._state.keys()
        delegation_keys = [k for k in all_keys if k.startswith(_KEY_PREFIX)]
        cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        removed = 0

        for key in delegation_keys:
            data = await self._state.get(key)
            if not data:
                continue
            if data.get("status") not in ("announced", "failed"):
                continue
            completed = data.get("completed_at")
            if completed:
                try:
                    ts = datetime.fromisoformat(completed).timestamp()
                    if ts < cutoff:
                        await self._state.delete(key)
                        removed += 1
                except (ValueError, TypeError):
                    pass

        if removed:
            logger.info("delegation_cleanup", removed=removed)
        return removed


class DelegationWorker:
    """Background service that executes pending delegations via orchestrator.run_agent()."""

    def __init__(
        self,
        registry: DelegationRegistry,
        orchestrator: Any,
        event_store: Any = None,
        memory_manager: Any = None,
        poll_interval: float = 2.0,
    ):
        self._registry = registry
        self._orchestrator = orchestrator
        self._events = event_store
        self._memory = memory_manager
        self._poll_interval = poll_interval
        self._running = False
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        """Start the background worker loop.

        Recovers any delegations stuck in 'running' (from a previous crash)
        by resetting them to 'pending' before starting the loop.
        """
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._start_with_recovery())
        logger.info("delegation_worker_started")

    async def _start_with_recovery(self) -> None:
        """Recover stuck 'running' delegations, then enter main loop."""
        try:
            await self._recover_running()
        except Exception as e:
            logger.error("delegation_recovery_failed", error=str(e))
        await self._loop()

    async def _recover_running(self) -> None:
        """Reset delegations stuck in 'running' back to 'pending'."""
        all_keys = await self._registry._state.keys()
        delegation_keys = [k for k in all_keys if k.startswith(_KEY_PREFIX)]
        recovered = 0
        for key in delegation_keys:
            data = await self._registry._state.get(key)
            if not data or data.get("status") != "running":
                continue
            delegation_id = key[len(_KEY_PREFIX):]
            await self._registry.update_status(
                delegation_id, "pending", error="recovered after restart",
            )
            recovered += 1
        if recovered:
            logger.info("delegation_recovery", recovered=recovered)

    def stop(self) -> None:
        """Signal the worker to stop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("delegation_worker_stopped")

    async def _loop(self) -> None:
        """Poll for pending delegations and execute them."""
        while self._running:
            try:
                pending = await self._registry.pending_work()
                for req in pending:
                    if not self._running:
                        break
                    await self._execute(req)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("delegation_worker_error", error=str(e))

            try:
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                break

    async def _execute(self, req: DelegationRequest) -> None:
        """Execute a single delegation request."""
        logger.info(
            "delegation_executing",
            delegation_id=req.id,
            agent=req.agent_name,
            conversation_id=req.conversation_id,
        )

        await self._registry.update_status(req.id, "running")

        try:
            result = await self._orchestrator.run_agent(req.agent_name, task=req.task)
            status = result.get("status", "completed") if isinstance(result, dict) else "completed"
            # Normalize to our status values
            final_status = "completed" if status != "failed" else "failed"
            error = result.get("error") if isinstance(result, dict) else None

            await self._registry.update_status(
                req.id,
                final_status,
                result=result if isinstance(result, dict) else {"response": str(result)},
                error=error,
            )

            logger.info(
                "delegation_completed",
                delegation_id=req.id,
                agent=req.agent_name,
                status=final_status,
                duration=result.get("duration_seconds") if isinstance(result, dict) else None,
            )

        except Exception as e:
            await self._registry.update_status(
                req.id,
                "failed",
                error=str(e)[:500],
            )
            logger.error(
                "delegation_failed",
                delegation_id=req.id,
                agent=req.agent_name,
                error=str(e),
            )
