"""
PodClaw — Unified Agent Core
================================

Single cognitive entrypoint for all event sources (cron, heartbeat, chat).

handle_event() enriches the task with contextual awareness (SOUL, MEMORY,
daily activity) and delegates execution to orchestrator.run_agent(), which
retains all existing protections (circuit breaker, concurrency lock, cost
tracking, session resume, memory logging).

Source format:
  "cron:researcher"            → agent=researcher, task_key=researcher
  "cron:cataloger:pricing"     → agent=cataloger,  task_key=cataloger_pricing
  "heartbeat:researcher"       → agent=researcher  (dispatch from heartbeat)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from podclaw.core import Orchestrator
    from podclaw.memory_manager import MemoryManager
    from podclaw.state_store import StateStore
    from podclaw.delegation import DelegationRegistry

logger = structlog.get_logger(__name__)


class PodClawAgent:
    """Unified cognitive entrypoint for PodClaw events.

    Wraps orchestrator.run_agent() with contextual enrichment.
    Does NOT replicate protections — all safety lives in run_agent().
    """

    def __init__(
        self,
        orchestrator: "Orchestrator",
        memory_manager: "MemoryManager",
        state_store: "StateStore | None" = None,
        delegation_registry: "DelegationRegistry | None" = None,
    ):
        self._orchestrator = orchestrator
        self._memory = memory_manager
        self._state = state_store
        self._delegation_registry = delegation_registry
        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None
        self._running: bool = False

    def start(self) -> None:
        """Start the single-execution worker loop."""
        if not self._running:
            self._running = True
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("agent_worker_started")

    def stop(self) -> None:
        """Stop the worker loop and drain pending futures."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
        # Drain queue: resolve all pending futures so callers don't hang
        drained = 0
        while not self._queue.empty():
            try:
                _, _, _, future = self._queue.get_nowait()
                if not future.done():
                    future.set_exception(RuntimeError("agent shutting down"))
                self._queue.task_done()
                drained += 1
            except asyncio.QueueEmpty:
                break
        logger.info("agent_worker_stopped", drained=drained)

    async def enqueue_event(
        self,
        source: str,
        message: str = "Scheduled cycle trigger",
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        """Enqueue an event for sequential processing.

        Returns the result once the worker processes it.
        """
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        await self._queue.put((source, message, conversation_id, future))
        return await future

    async def handle_event(
        self,
        source: str,
        message: str = "Scheduled cycle trigger",
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        """Unified cognitive entrypoint (alias for enqueue_event).

        Backward-compatible wrapper. All events are serialized through
        the internal queue to guarantee single-execution.
        """
        return await self.enqueue_event(source, message, conversation_id)

    async def _worker_loop(self) -> None:
        """Single-execution worker — processes events one at a time."""
        while self._running:
            try:
                source, message, conversation_id, future = await self._queue.get()
            except asyncio.CancelledError:
                break
            try:
                result = await self._handle_event_internal(
                    source, message, conversation_id,
                )
                if not future.done():
                    future.set_result(result)
            except asyncio.CancelledError:
                if not future.done():
                    future.set_exception(RuntimeError("agent shutting down"))
                break
            except Exception as e:
                if not future.done():
                    future.set_exception(e)
            finally:
                self._queue.task_done()

    async def _handle_event_internal(
        self,
        source: str,
        message: str = "Scheduled cycle trigger",
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        """Internal handler — executes the cognitive event.

        Enriches the task with SOUL/MEMORY/daily context, then delegates
        to orchestrator.run_agent() which handles all protections.
        """
        agent_name, task_key = self._parse_source(source)

        if not agent_name:
            logger.error("handle_event_no_agent", source=source)
            return {"status": "error", "reason": f"cannot parse agent from source: {source}"}

        # Build enriched task with cognitive context
        enriched_task = self._build_cognitive_task(source, message, agent_name, task_key)

        logger.info(
            "handle_event",
            source=source,
            agent=agent_name,
            task_key=task_key,
            task_len=len(enriched_task),
        )

        # Delegate to run_agent() — all protections preserved
        return await self._orchestrator.run_agent(agent_name, task=enriched_task)

    def _parse_source(self, source: str) -> tuple[str | None, str | None]:
        """Parse source string into (agent_name, task_key).

        Examples:
            "cron:researcher"            → ("researcher", "researcher")
            "cron:cataloger:pricing"     → ("cataloger", "cataloger_pricing")
            "cron:cataloger:peakprep"    → ("cataloger", "cataloger_peakprep")
            "heartbeat:researcher"       → ("researcher", "researcher")
        """
        parts = source.split(":")
        if len(parts) < 2:
            return None, None

        prefix = parts[0]  # "cron" or "heartbeat"
        agent_name = parts[1]

        if len(parts) >= 3:
            # "cron:cataloger:pricing" → task_key = "cataloger_pricing"
            suffix = parts[2]
            task_key = f"{agent_name}_{suffix}"
        else:
            task_key = agent_name

        return agent_name, task_key

    def _build_cognitive_task(
        self,
        source: str,
        message: str,
        agent_name: str,
        task_key: str,
    ) -> str:
        """Enrich the task with cognitive context from SOUL, MEMORY, and daily log."""
        # Get the detailed task prompt from orchestrator._default_task()
        default_task = self._orchestrator._default_task(task_key)

        # Load context (lightweight reads, no LLM calls)
        context = self._load_context()

        if source.startswith("cron:"):
            return (
                f"[SCHEDULED TASK]\n"
                f"{default_task}\n\n"
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

        # Fallback: pass message with context
        return f"{message}\n\n[CONTEXT]\n{context}"

    def _load_context(self) -> str:
        """Load SOUL, MEMORY, and daily activity as compact context block."""
        parts = []

        soul = ""
        try:
            soul = self._memory.read_soul()
        except Exception:
            pass
        if soul:
            # Only include identity section (first ~500 chars)
            parts.append(f"SOUL: {soul[:500]}")

        memory = ""
        try:
            memory = self._memory.read_memory()
        except Exception:
            pass
        if memory:
            parts.append(f"MEMORY: {memory[:500]}")

        daily = ""
        try:
            daily_path = self._memory._daily_log_path()
            if daily_path.exists():
                daily = daily_path.read_text()
        except Exception:
            pass
        if daily:
            # Last 500 chars of today's activity
            parts.append(f"TODAY: {daily[-500:]}")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        parts.insert(0, f"Timestamp: {now}")

        return "\n".join(parts)
