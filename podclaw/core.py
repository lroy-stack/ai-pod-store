# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Orchestrator
========================

Central orchestrator that routes tasks to 7 autonomous agents.
Event-driven — no cron schedules. Heartbeat as consciousness pulse.
System prompt composition: SOUL → CEO → HEARTBEAT → MEMORY → manifests.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from claude_agent_sdk import ResultMessage

from podclaw.config import (
    AGENT_CONTEXT_FILES,
    AGENT_CATALOG_FILES,
    AGENT_MODELS,
    AGENT_NAMES,
    AGENT_TOOLS,
    DAILY_LOG_TAIL_LINES,
    IDENTITY_FILES,
    MAX_ACTIONS_PER_CYCLE,
    MAX_SESSION_DURATION_SECONDS,
    ORCHESTRATOR_DAILY_BUDGET_EUR,
    ORCHESTRATOR_IDLE_TIMEOUT_SECONDS,
    ORCHESTRATOR_MODEL,
    STORE_PHYSICAL_ADDRESS,
)
from podclaw.client_factory import ClientFactory
from podclaw.event_store import EventStore
from podclaw.memory_manager import MemoryManager
from podclaw.skill_registry import SkillRegistry
from podclaw.state_store import StateStore

from podclaw.orchestrator_prompt import OrchestratorStartup
from podclaw.prompts import SECURITY_PREAMBLE

logger = structlog.get_logger(__name__)

ALL_SESSION_TYPES = AGENT_NAMES + ["heartbeat", "consolidation"]


# OrchestratorStartup → moved to podclaw/orchestrator_prompt.py


class Orchestrator:
    """
    Routes tasks to sub-agents and manages the PodClaw lifecycle.
    Event-driven — tasks come from event dispatch, not cron schedules.

    Responsibilities:
    - Compose system prompts (identity + memory + skills)
    - Create agent sessions with skill-aware context
    - Track active sessions and prevent concurrent runs
    - Handle errors with circuit breaker pattern
    - Run memory consolidation
    """

    def __init__(
        self,
        client_factory: ClientFactory,
        event_store: EventStore,
        memory_manager: MemoryManager,
        skill_registry: SkillRegistry,
        state_store: StateStore | None = None,
        workspace: Path | None = None,
    ):
        self.factory = client_factory
        self.events = event_store
        self.memory = memory_manager
        self.skills = skill_registry
        self.state = state_store
        self.startup = OrchestratorStartup(
            memory=memory_manager,
            skill_registry=skill_registry,
            workspace=workspace or Path.cwd(),
        )
        self._active_sessions: dict[str, str] = {}  # agent_name → session_id
        self._agent_sdk_sessions: dict[str, Any] = {}  # agent_name → {session_id, timestamp}
        self._ceo_sdk_sessions: dict[str, Any] = {}  # "ceo:{platform}" → {session_id, timestamp}
        self._disabled_agents: set[str] = set()
        self._running = False
        self._session_lock = asyncio.Lock()
        # CEO message queues — one per platform, sequential processing
        self._ceo_queues: dict[str, asyncio.Queue] = {}
        self._ceo_workers: dict[str, asyncio.Task] = {}

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        self._running = True
        asyncio.create_task(self._restore_sdk_sessions())
        asyncio.create_task(self._restore_disabled_agents())
        logger.info("orchestrator_started")

    async def _restore_sdk_sessions(self) -> None:
        """Restore SDK session IDs from local SQLite state store."""
        if not self.state:
            return
        # Restore agent sessions
        agent_sessions = await self.state.get("agent_sdk_sessions", {})
        if agent_sessions:
            self._agent_sdk_sessions.update(agent_sessions)
        # Restore CEO sessions
        ceo_sessions = await self.state.get("ceo_sdk_sessions", {})
        if ceo_sessions:
            self._ceo_sdk_sessions.update(ceo_sessions)
        total = len(agent_sessions) + len(ceo_sessions)
        if total:
            logger.info("sdk_sessions_restored", agents=len(agent_sessions), ceo=len(ceo_sessions))

    async def _restore_disabled_agents(self) -> None:
        """Restore disabled agents set from local SQLite state store."""
        if not self.state:
            return
        disabled = await self.state.get("disabled_agents", [])
        if disabled:
            self._disabled_agents = set(disabled)
            logger.info("disabled_agents_restored", agents=list(self._disabled_agents))

    async def disable_agent(self, agent_name: str) -> None:
        """Disable an agent (kill-switch). Persists across restarts."""
        self._disabled_agents.add(agent_name)
        if self.state:
            await self.state.set("disabled_agents", list(self._disabled_agents))
        logger.critical("agent_disabled", agent=agent_name)

    async def enable_agent(self, agent_name: str) -> None:
        """Re-enable a previously disabled agent. Persists across restarts."""
        self._disabled_agents.discard(agent_name)
        if self.state:
            await self.state.set("disabled_agents", list(self._disabled_agents))
        logger.warning("agent_enabled", agent=agent_name)

    def stop(self) -> None:
        self._running = False
        self._active_sessions.clear()
        logger.info("orchestrator_stopped")

    # -----------------------------------------------------------------------
    # Session Resume (SDK session persistence)
    # -----------------------------------------------------------------------

    _SESSION_IDLE_SECONDS = ORCHESTRATOR_IDLE_TIMEOUT_SECONDS

    def _session_store(self, key: str) -> dict[str, Any]:
        """Return the correct session dict based on key prefix."""
        return self._ceo_sdk_sessions if key.startswith("ceo:") else self._agent_sdk_sessions

    _SESSION_DAILY_RESET_HOUR = 4  # UTC hour for daily session reset

    def _get_resumable_session(self, key: str) -> str | None:
        """Get a resumable SDK session_id, if one exists and is not expired.

        Sessions expire via:
        1. Idle timeout (30min default)
        2. Daily boundary (4 AM UTC — fresh context each day)
        """
        store = self._session_store(key)
        session_data = store.get(key)
        if not session_data:
            return None
        if isinstance(session_data, str):
            return session_data
        sid = session_data.get("session_id")
        ts = session_data.get("timestamp", 0)
        now = datetime.now(timezone.utc)

        # Idle timeout
        if (now.timestamp() - ts) > self._SESSION_IDLE_SECONDS:
            logger.info("session_expired_idle", key=key)
            store.pop(key, None)
            return None

        # Daily reset at configured hour (default 4 AM UTC)
        from datetime import timedelta
        reset_time = now.replace(
            hour=self._SESSION_DAILY_RESET_HOUR, minute=0, second=0, microsecond=0
        )
        if now.hour < self._SESSION_DAILY_RESET_HOUR:
            reset_time -= timedelta(days=1)
        if ts < reset_time.timestamp():
            logger.info("session_daily_reset", key=key)
            store.pop(key, None)
            return None

        return sid

    async def _save_sdk_session(self, key: str, sdk_session_id: str) -> None:
        """Persist SDK session_id for future resume."""
        store = self._session_store(key)
        store[key] = {
            "session_id": sdk_session_id,
            "timestamp": datetime.now(timezone.utc).timestamp(),
        }
        if self.state:
            store_key = "ceo_sdk_sessions" if key.startswith("ceo:") else "agent_sdk_sessions"
            await self.state.set(store_key, store)
        logger.info("session_saved", key=key, session_id=sdk_session_id[:12])

    # -----------------------------------------------------------------------
    # System Prompt Composition
    # -----------------------------------------------------------------------

    def build_sub_agent_prompt(
        self,
        agent_name: str,
        task_description: str,
        pipeline_context: list[dict] | None = None,
    ) -> str:
        """Build sub-agent system prompt.

        Implements MEMORY_IDENTITY_DEFINITION.md Section 3.2.
        Structure: Security preamble → ROLE.md → task skill → references → context → system state.
        """
        parts: list[str] = [SECURITY_PREAMBLE]

        # [1] ROLE.md (agent identity — always loaded)
        role = self.skills.load_role(agent_name)
        if role:
            parts.append(role)

        # [2] Task Skill (dynamically selected via keyword matching)
        skill_name = self.skills.find_skill_for_task(agent_name, task_description)
        if skill_name:
            skill_content = self.skills.load_task_skill(agent_name, skill_name)
            if skill_content.task_md:
                parts.append(skill_content.task_md)
            # [3] Reference Skills (loaded alongside task skill)
            for ref in skill_content.references:
                parts.append(ref)

        # [4] Context Injection (from pipeline engine)
        if pipeline_context:
            ctx_lines = ["## Pipeline Context\n"]
            for step in pipeline_context:
                step_name = step.get("step", "unknown")
                step_result = step.get("result", "")
                ctx_lines.append(f"### {step_name}\n{step_result[:500]}\n")
            parts.append("\n".join(ctx_lines))

        # [5] Agent context files (operational data) — exclude MEMORY.md (orchestrator-only)
        context_files = AGENT_CONTEXT_FILES.get(agent_name, [])
        context = self.memory.load_agent_context_summary(agent_name, context_files, include_memory=False)
        if context:
            parts.append(context)

        # [6] Catalog reference (read-only EU product data)
        catalog_files = AGENT_CATALOG_FILES.get(agent_name, [])
        if catalog_files:
            catalog = self.memory.load_catalog_summary(agent_name, catalog_files)
            if catalog:
                parts.append(catalog)

        # [7] File paths for Write/Read
        ctx_dir = self.memory.context_dir.resolve()
        agent_files = AGENT_CONTEXT_FILES.get(agent_name, [])
        if agent_files:
            path_lines = [f"- {f}: {ctx_dir / f}" for f in agent_files]
            parts.append(
                "## File Paths (ALWAYS use these absolute paths for Write/Read)\n"
                f"- Context directory: {ctx_dir}\n"
                + "\n".join(path_lines)
            )

        # [8] System context (date, budget remaining)
        now = datetime.now(timezone.utc)
        parts.append(
            "## System Context\n\n"
            f"- **Current time (UTC)**: {now.strftime('%Y-%m-%d %H:%M')}\n"
            f"- **Agent**: {agent_name}\n"
            f"- **Currency**: EUR only\n"
            f"- **Provider**: Printful (EU fulfillment)"
        )

        return "\n\n---\n\n".join(parts)

    # -----------------------------------------------------------------------
    # Circuit Breaker
    # -----------------------------------------------------------------------

    async def _check_circuit_breaker(self, agent_name: str) -> bool:
        """Check if circuit breaker is open for an agent (>=3 errors in 24h).

        Fail-open: if we can't check (no DB), allow dispatch.
        """
        if not self.events._client:
            return False
        try:
            from datetime import timedelta
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            result = await asyncio.to_thread(
                lambda: self.events._client.table("agent_events")
                .select("id", count="exact")
                .eq("event_type", "error")
                .eq("agent_name", agent_name)
                .gte("created_at", cutoff)
                .execute()
            )
            count = result.count if hasattr(result, 'count') and result.count else len(result.data or [])
            if count >= 3:
                logger.warning("circuit_breaker_open", agent=agent_name, errors_24h=count)
                return True
        except Exception:
            pass  # Fail-open
        return False

    # -----------------------------------------------------------------------
    # Agent Execution
    # -----------------------------------------------------------------------

    async def run_agent(
        self,
        agent_name: str,
        task: str,
        force_fresh: bool = False,
        pipeline_context: list[dict] | None = None,
        skill_hint: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute a sub-agent with full prompt composition.

        Args:
            agent_name: One of the 7 agent names
            task: Task description (required — no default tasks)
            force_fresh: If True, start a new SDK session instead of resuming
            pipeline_context: Results from previous pipeline steps
            skill_hint: Force a specific skill name instead of auto-matching

        Returns:
            Session result dict with events, duration, etc.
        """
        if agent_name not in AGENT_NAMES:
            logger.error("unknown_agent", agent=agent_name)
            return {"status": "error", "reason": f"unknown agent: {agent_name}"}

        if agent_name in self._disabled_agents:
            logger.warning("agent_disabled_skipped", agent=agent_name)
            return {"status": "skipped", "reason": f"agent '{agent_name}' is disabled"}

        if await self._check_circuit_breaker(agent_name):
            logger.warning("circuit_breaker_blocked", agent=agent_name)
            return {"status": "skipped", "reason": f"circuit breaker open for {agent_name} (>=3 errors in 24h)"}

        # Acquire lock for check-then-set of _active_sessions
        try:
            async with asyncio.timeout(60):
                await self._session_lock.acquire()
        except TimeoutError:
            logger.error("session_lock_timeout", agent=agent_name, timeout_s=60)
            return {"status": "error", "reason": "session lock timeout after 60s"}

        try:
            if not self._running:
                logger.warning("orchestrator_not_running", agent=agent_name)
                return {"status": "skipped", "reason": "orchestrator not running"}

            if agent_name in self._active_sessions:
                logger.warning("agent_already_running", agent=agent_name)
                return {"status": "skipped", "reason": "already running"}

            # Reset rate limit counters for this agent's new session
            from podclaw.hooks.rate_limit_hook import reset_counters
            await reset_counters(agent_name)

            session_id = str(uuid.uuid4())
            self._active_sessions[agent_name] = session_id
        finally:
            self._session_lock.release()

        # Distributed Redis singleton lock
        from podclaw.redis_store import acquire_agent_lock, release_agent_lock
        redis_lock_acquired = await acquire_agent_lock(agent_name, session_id)
        if not redis_lock_acquired:
            # Redis lock failed — proceed anyway (fail-open for single-container setup)
            logger.warning("agent_redis_lock_failed_proceeding", agent=agent_name)

        start_time = datetime.now(timezone.utc)

        await self.events.record_session(
            session_id=session_id,
            session_type=agent_name,
            status="running",
        )

        await self.events.record(
            agent_name=agent_name,
            event_type="session_start",
            payload={"task": task},
            session_id=session_id,
        )

        result: dict[str, Any] = {
            "agent": agent_name,
            "session_id": session_id,
            "status": "completed",
            "start_time": start_time.isoformat(),
        }

        try:
            # Session resume: reuse SDK session if available and not expired
            resume_sdk_session = None
            if not force_fresh:
                resume_sdk_session = self._get_resumable_session(agent_name)

            # Build skill-aware system prompt for this agent
            system_prompt = self.build_sub_agent_prompt(
                agent_name, task, pipeline_context
            )

            options = self.factory.create_client(
                agent_name,
                session_id=session_id,
                resume_sdk_session=resume_sdk_session,
                system_prompt_override=system_prompt,
            )
            # Use shared SDK query execution (same as orchestrator)
            tool_calls, response_text, result_message, sdk_session_id = (
                await self._execute_sdk_query(task, options)
            )

            if result_message:
                result["num_turns"] = getattr(result_message, "num_turns", None)
                result["total_cost_usd"] = getattr(result_message, "total_cost_usd", None)
                result["session_id_sdk"] = getattr(result_message, "session_id", None)
                result["usage"] = getattr(result_message, "usage", None)

                # Persist SDK session_id for resume (volume-backed now)
                if sdk_session_id:
                    self._save_sdk_session(agent_name, sdk_session_id)

                llm_cost = getattr(result_message, "total_cost_usd", None)
                if llm_cost and llm_cost > 0:
                    from podclaw.hooks.cost_guard_hook import record_session_cost
                    await record_session_cost(agent_name, llm_cost)

            result["response"] = response_text[:2000]
            result["tool_calls"] = tool_calls

            await self.memory.append_daily(
                agent_name,
                f"Session {session_id[:8]}: {task[:100]}... → completed ({tool_calls} tool calls)"
            )

        except asyncio.TimeoutError:
            result["status"] = "error"
            result["error"] = f"Session timed out after {MAX_SESSION_DURATION_SECONDS}s"
            logger.critical(
                "agent_session_timeout",
                agent=agent_name,
                timeout_seconds=MAX_SESSION_DURATION_SECONDS,
                session_id=session_id,
            )
            await self.events.record(
                agent_name=agent_name,
                event_type="error",
                payload={"error": f"Session timed out after {MAX_SESSION_DURATION_SECONDS}s"},
                session_id=session_id,
            )

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            logger.error("agent_execution_failed", agent=agent_name, error=str(e))
            await self.events.record(
                agent_name=agent_name,
                event_type="error",
                payload={"error": str(e)},
                session_id=session_id,
            )

        finally:
            # No client.disconnect() needed — query() manages its own lifecycle

            end_time = datetime.now(timezone.utc)
            result["end_time"] = end_time.isoformat()
            result["duration_seconds"] = (end_time - start_time).total_seconds()

            try:
                async with asyncio.timeout(60):
                    async with self._session_lock:
                        self._active_sessions.pop(agent_name, None)
            except TimeoutError:
                self._active_sessions.pop(agent_name, None)
                logger.error("session_cleanup_lock_timeout", agent=agent_name)

            try:
                from podclaw.redis_store import release_agent_lock
                await release_agent_lock(agent_name, session_id)
            except Exception as e:
                logger.warning("agent_lock_release_error", agent=agent_name, error=str(e))

            await self.events.record(
                agent_name=agent_name,
                event_type="session_end",
                payload=result,
                session_id=session_id,
            )

            await self.events.update_session(
                session_id=session_id,
                status=result.get("status", "completed"),
                tool_calls=result.get("tool_calls", 0),
                tool_errors=0,
                error_log=result.get("error"),
            )

            await self.events.record_audit(
                actor_id=f"podclaw:{agent_name}",
                action="agent_session",
                resource_type="agent_session",
                resource_id=session_id,
                changes={"status": result.get("status", "completed"), "tool_calls": result.get("tool_calls", 0)},
                metadata={"agent": agent_name, "duration_seconds": result.get("duration_seconds")},
            )

        self._write_session_feedback(agent_name, result)

        if result.get("status") == "completed" and result.get("response"):
            asyncio.create_task(
                self._extract_and_persist_learnings(agent_name, result)
            )

        return result

    def _write_session_feedback(self, agent_name: str, result: dict[str, Any]) -> None:
        """Write a descriptive summary of the last session to context file."""
        try:
            feedback_path = self.memory.context_dir / "last_session_feedback.md"
            feedback_path.parent.mkdir(parents=True, exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            cost = result.get("total_cost_usd")
            cost_str = f"${cost:.2f}" if cost else "unknown"
            duration = result.get("duration_seconds", 0)
            session_id = result.get("session_id", "?")
            response = result.get("response", "")
            response_summary = response[:300].strip() if response else "(no response captured)"

            lines = [
                f"## Last Session: {agent_name}",
                f"- **When**: {ts}",
                f"- **Session**: {session_id[:8]}",
                f"- **Status**: {result.get('status', 'unknown')}",
                f"- **Tools called**: {result.get('tool_calls', 0)}",
                f"- **Cost**: {cost_str}",
                f"- **Duration**: {duration:.0f}s",
                f"- **Turns**: {result.get('num_turns', '?')}",
                "",
                "### What happened",
                response_summary,
            ]
            if result.get("error"):
                lines.extend(["", "### Error", result["error"][:300]])
            feedback_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        except Exception as e:
            logger.warning("session_feedback_write_failed", error=str(e))

    async def run_agent_with_retry(
        self, agent_name: str, task: str, max_retries: int = 2,
        force_fresh: bool = False,
        pipeline_context: list[dict] | None = None,
    ) -> dict[str, Any]:
        """Execute a sub-agent with automatic retry on failure.

        Uses exponential backoff: 5s, 10s between retries.
        """
        result: dict[str, Any] = {}
        for attempt in range(max_retries + 1):
            retry_fresh = force_fresh if attempt == 0 else False
            result = await self.run_agent(
                agent_name, task,
                force_fresh=retry_fresh,
                pipeline_context=pipeline_context,
            )
            if result.get("status") != "error":
                return result
            if attempt < max_retries:
                wait = 2 ** attempt * 5
                logger.warning(
                    "agent_retry",
                    agent=agent_name,
                    attempt=attempt + 1,
                    wait_seconds=wait,
                    error=result.get("error", "unknown"),
                )
                await asyncio.sleep(wait)
        return result

    # -----------------------------------------------------------------------
    # Incremental Learning
    # -----------------------------------------------------------------------

    async def _extract_and_persist_learnings(
        self, agent_name: str, result: dict[str, Any]
    ) -> None:
        """Extract key learnings from an agent's response and persist to MEMORY.md.

        Uses Haiku for cheap extraction (~$0.001 per call). Only persists
        genuinely novel insights — not routine confirmations.
        """
        response = result.get("response", "")
        if len(response) < 100:
            return

        try:
            from podclaw.llm_helper import quick_llm_call

            extraction = await quick_llm_call(
                system_prompt=(
                    "You extract durable learnings from an AI agent's work session.\n"
                    "Return 1-3 bullet points of genuinely novel insights.\n"
                    "Skip routine actions like 'queried database' or 'checked data'.\n"
                    "Focus on: data anomalies found, new patterns discovered, "
                    "configuration issues, pricing problems, quality gaps.\n"
                    "If there's nothing truly novel, respond with exactly: NONE\n"
                    "Use '- ' prefix for each bullet. Max 200 chars per bullet."
                ),
                user_prompt=(
                    f"Agent: {agent_name}\n"
                    f"Tools used: {result.get('tool_calls', 0)}\n"
                    f"Cost: ${result.get('total_cost_usd', 0):.3f}\n\n"
                    f"Response:\n{response[:1500]}"
                ),
                model="claude-haiku-4-5-20251001",
                max_budget=0.005,
            )

            extraction = extraction.strip()
            if extraction == "NONE" or not extraction:
                return

            for line in extraction.splitlines():
                line = line.strip()
                if line.startswith("- ") and len(line) > 5:
                    await self.memory.append_memory(f"[{agent_name}] {line[2:]}")

            logger.info(
                "incremental_learning_saved",
                agent=agent_name,
                learnings=len([l for l in extraction.splitlines() if l.strip().startswith("- ")]),
            )

        except Exception as e:
            logger.debug("incremental_learning_failed", agent=agent_name, error=str(e))

    # -----------------------------------------------------------------------
    # Memory Consolidation
    # -----------------------------------------------------------------------

    async def run_consolidation(self, soul_evolution=None) -> None:
        """Run memory consolidation, with optional soul review."""
        logger.info("consolidation_starting")
        await self.memory.run_consolidation()

        if soul_evolution:
            if datetime.now(timezone.utc).weekday() == 6:  # Sunday
                await self._review_soul(soul_evolution)

    async def _review_soul(self, soul_evolution) -> None:
        """LLM compares SOUL.md + recent MEMORY.md and proposes changes."""
        from podclaw.config import CONSOLIDATION_MODEL

        soul = self.memory.read_soul()
        memory = self.memory.read_memory()

        if not soul:
            return

        try:
            from podclaw.llm_helper import quick_llm_call

            text = await quick_llm_call(
                system_prompt=(
                    "You are PodClaw's soul evolution reviewer. Compare the current SOUL.md "
                    "with recent memory/learnings. Decide if any section should be updated. "
                    "Respond with JSON: {\"action\": \"NO_CHANGES\"} or "
                    "{\"action\": \"PROPOSE\", \"section\": \"Section Name\", "
                    "\"proposed\": \"new content\", \"reasoning\": \"why\"}. "
                    "Only propose changes based on strong evidence from memory. "
                    "NEVER propose changes to sections inside <!-- IMMUTABLE --> markers."
                ),
                user_prompt=(
                    f"## Current SOUL.md\n{soul[:4000]}\n\n"
                    f"## Recent Memory\n{memory[-3000:]}\n\n"
                    "Should any section of SOUL.md be updated?"
                ),
                model=CONSOLIDATION_MODEL,
                max_budget=0.03,
            )

            import json
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(text)

            if result.get("action") == "PROPOSE":
                await soul_evolution.propose_change(
                    section=result["section"],
                    proposed_content=result["proposed"],
                    reasoning=result["reasoning"],
                )
                logger.info("soul_review_proposed", section=result["section"])
            else:
                logger.info("soul_review_no_changes")

        except Exception as e:
            logger.warning("soul_review_failed", error=str(e))

    # -----------------------------------------------------------------------
    # Status
    # -----------------------------------------------------------------------

    def get_status(self) -> dict[str, Any]:
        """Get current orchestrator status."""
        return {
            "running": self._running,
            "active_sessions": dict(self._active_sessions),
            "agent_count": len(AGENT_NAMES),
            "agents": list(AGENT_NAMES),
        }

    def get_agent_status(self, agent_name: str) -> dict[str, Any]:
        """Get status for a specific agent."""
        return {
            "agent": agent_name,
            "running": agent_name in self._active_sessions,
            "session_id": self._active_sessions.get(agent_name),
            "model": AGENT_MODELS.get(agent_name),
            "tools": AGENT_TOOLS.get(agent_name, []),
            "disabled": agent_name in self._disabled_agents,
        }

    # -----------------------------------------------------------------------
    # SDK Query Execution (shared between run_agent and run_orchestrator)
    # -----------------------------------------------------------------------

    async def _execute_sdk_query(
        self, task: str, options: Any,
        on_tool_call: Any = None,
        on_text: Any = None,
    ) -> tuple[int, str, Any, str | None]:
        """Execute an SDK query in a dedicated thread with fresh event loop.

        Returns (tool_calls, response_text, result_message, sdk_session_id).
        on_tool_call: async callback(tool_name) — fires for each tool call.
        on_text: async callback(text) — fires for intermediate text (before tool calls).
          The LAST text block (final response) is NOT sent via on_text — it's returned.

        Uses loop.call_soon_threadsafe() for thread-safe main loop notification.
        """
        import concurrent.futures
        from claude_agent_sdk import query as sdk_query

        main_loop = asyncio.get_event_loop()

        def _notify(coro_fn, *args):
            """Schedule an async callback on the main loop from the SDK thread."""
            main_loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(coro_fn(*args)),
            )

        def _run_in_thread():
            _tc = 0
            _final_text = ""
            _result = None
            _sid = None

            async def _inner():
                nonlocal _tc, _final_text, _result, _sid

                async def _prompt():
                    yield {
                        "type": "user",
                        "message": {"role": "user", "content": task},
                    }

                async for msg in sdk_query(prompt=_prompt(), options=options):
                    if isinstance(msg, ResultMessage):
                        _result = msg
                        _sid = getattr(msg, "session_id", None)
                        break
                    if hasattr(msg, "subtype") and msg.subtype == "init":
                        _sid = getattr(msg, "session_id", None)
                        continue
                    if not hasattr(msg, "content"):
                        continue

                    # Process blocks in order within each AssistantMessage.
                    # Text before a tool call = intermediate (send to CEO).
                    # Text after all tool calls in a message = accumulate for final.
                    pending_text = ""
                    has_tool_in_msg = False

                    for block in msg.content:
                        bt = type(block).__name__
                        if bt == "ToolUseBlock":
                            has_tool_in_msg = True
                            _tc += 1
                            # Send any pending text as intermediate message
                            if pending_text.strip() and on_text:
                                _notify(on_text, pending_text.strip())
                                pending_text = ""
                            if on_tool_call:
                                _notify(on_tool_call, block.name)
                        elif bt == "TextBlock":
                            pending_text += block.text

                    # After processing all blocks in this message:
                    if has_tool_in_msg and pending_text.strip() and on_text:
                        # Text after tool calls in same message — send as intermediate
                        _notify(on_text, pending_text.strip())
                    else:
                        # Pure text message (no tools) — accumulate as final response
                        _final_text += pending_text

            asyncio.run(_inner())
            return _tc, _final_text, _result, _sid

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = main_loop.run_in_executor(pool, _run_in_thread)
            return await asyncio.wait_for(
                future, timeout=MAX_SESSION_DURATION_SECONDS,
            )

    # -----------------------------------------------------------------------
    # CEO Orchestrator (conversational, stateful via session resume)
    # -----------------------------------------------------------------------

    async def run_orchestrator(
        self, platform: str, text: str, image_url: str | None = None,
        on_tool_call: Any = None, on_text: Any = None,
    ) -> dict[str, Any]:
        """Run the CEO conversational orchestrator.

        Messages are queued per platform to prevent "already running" rejections.
        on_tool_call: async callback(tool_name) — tool visibility.
        on_text: async callback(text) — intermediate text messages.
        """
        key = f"ceo:{platform}"

        # Ensure queue + worker exist — restart worker if it died
        if key not in self._ceo_queues:
            self._ceo_queues[key] = asyncio.Queue()
        worker = self._ceo_workers.get(key)
        if worker is None or worker.done():
            if worker and worker.done():
                logger.warning("ceo_worker_restarting", session_key=key)
            self._ceo_workers[key] = asyncio.create_task(
                self._ceo_worker(key)
            )

        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict] = loop.create_future()
        await self._ceo_queues[key].put((text, image_url, on_tool_call, on_text, future))
        return await future

    async def _ceo_worker(self, session_key: str) -> None:
        """Sequential worker loop for CEO messages on one platform.

        Crash-resilient: any exception is caught, logged, and the worker
        continues processing the next message. The CEO gets an error
        response but the platform stays alive.
        """
        queue = self._ceo_queues[session_key]
        consecutive_errors = 0
        while self._running:
            try:
                text, image_url, on_tool_call, on_text, future = await queue.get()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.critical("ceo_worker_queue_error", session_key=session_key, error=str(e))
                await asyncio.sleep(1)
                continue

            try:
                result = await self._run_orchestrator_internal(
                    session_key, text, image_url, on_tool_call, on_text,
                )
                if not future.done():
                    future.set_result(result)
                consecutive_errors = 0
            except Exception as e:
                consecutive_errors += 1
                logger.error(
                    "ceo_worker_execution_error",
                    session_key=session_key,
                    error=str(e),
                    consecutive=consecutive_errors,
                )
                if not future.done():
                    future.set_result({
                        "response": f"Error interno. Intenta de nuevo. ({str(e)[:100]})",
                        "tool_calls": 0, "cost_usd": 0, "duration_s": 0,
                    })
                # Backoff on consecutive errors to avoid tight crash loops
                if consecutive_errors >= 3:
                    logger.critical("ceo_worker_consecutive_errors", session_key=session_key, count=consecutive_errors)
                    await asyncio.sleep(5)
            finally:
                queue.task_done()

    async def _run_orchestrator_internal(
        self, session_key: str, text: str, image_url: str | None = None,
        on_tool_call: Any = None, on_text: Any = None,
    ) -> str:
        """Internal orchestrator execution — called sequentially by _ceo_worker."""
        session_id = str(uuid.uuid4())
        platform = session_key.replace("ceo:", "")

        # Get resumable SDK session for this platform
        resume_id = self._get_resumable_session(session_key)

        # Build fresh system prompt (picks up latest CEO.md, context, etc.)
        system_prompt = await self.startup.build_orchestrator_prompt()

        # Create orchestrator options with ALL tools
        options = self.factory.create_orchestrator(
            session_id=session_id,
            resume_sdk_session=resume_id,
            system_prompt_override=system_prompt,
        )

        # Build task
        task = f"[CEO via {platform}]\n{text}"
        if image_url:
            task += f"\n[Image: {image_url}]"

        start_time = datetime.now(timezone.utc)

        try:
            try:
                tool_calls, response_text, result_message, sdk_session_id = (
                    await self._execute_sdk_query(task, options, on_tool_call=on_tool_call, on_text=on_text)
                )
            except Exception as first_err:
                err_str = str(first_err).lower()
                # Context overflow → retry with fresh session (no resume)
                if resume_id and ("context" in err_str or "overflow" in err_str or "token" in err_str):
                    logger.warning("orchestrator_overflow_retry", platform=platform, error=str(first_err)[:100])
                    # Clear session and retry fresh
                    store = self._session_store(session_key)
                    store.pop(session_key, None)
                    options_fresh = self.factory.create_orchestrator(
                        session_id=session_id,
                        resume_sdk_session=None,
                        system_prompt_override=system_prompt,
                    )
                    tool_calls, response_text, result_message, sdk_session_id = (
                        await self._execute_sdk_query(task, options_fresh, on_tool_call=on_tool_call, on_text=on_text)
                    )
                else:
                    raise

            # Save session for resume (AWAIT, not fire-and-forget)
            if sdk_session_id:
                await self._save_sdk_session(session_key, sdk_session_id)

            # Record cost
            if result_message:
                llm_cost = getattr(result_message, "total_cost_usd", None)
                if llm_cost and llm_cost > 0:
                    from podclaw.hooks.cost_guard_hook import record_session_cost
                    await record_session_cost("orchestrator", llm_cost)

            # Daily log
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            await self.memory.append_daily(
                "orchestrator",
                f"CEO ({platform}): {text[:80]}... → "
                f"{tool_calls} tools, {duration:.0f}s"
            )

            logger.info(
                "orchestrator_completed",
                platform=platform,
                tool_calls=tool_calls,
                cost=getattr(result_message, "total_cost_usd", 0) if result_message else 0,
                duration_s=round(duration),
                response_len=len(response_text),
                resumed=resume_id is not None,
            )

            return {
                "response": response_text or "Tarea completada.",
                "tool_calls": tool_calls,
                "cost_usd": getattr(result_message, "total_cost_usd", 0) if result_message else 0,
                "duration_s": duration,
            }

        except asyncio.TimeoutError:
            logger.critical("orchestrator_timeout", platform=platform)
            return {"response": "Se agoto el tiempo de respuesta.", "tool_calls": 0, "cost_usd": 0, "duration_s": 0}

        except Exception as e:
            logger.error("orchestrator_error", platform=platform, error=str(e))
            return {"response": f"Error: {str(e)[:200]}", "tool_calls": 0, "cost_usd": 0, "duration_s": 0}
