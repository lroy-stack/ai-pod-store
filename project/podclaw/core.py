"""
PodClaw — Orchestrator
========================

Central orchestrator that routes tasks to the 8 sub-agents.
Manages agent lifecycle, session tracking, and error handling.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from claude_agent_sdk import ResultMessage

from podclaw.config import AGENT_MODELS, AGENT_TOOLS, MAX_ACTIONS_PER_CYCLE
from podclaw.client_factory import ClientFactory
from podclaw.event_store import EventStore
from podclaw.memory_manager import MemoryManager

logger = structlog.get_logger(__name__)

AGENT_NAMES = [
    "researcher", "marketing", "designer", "newsletter",
    "cataloger", "customer_manager", "seo_manager", "finance",
]

ALL_SESSION_TYPES = AGENT_NAMES + ["heartbeat", "consolidation"]


class Orchestrator:
    """
    Routes tasks to sub-agents and manages the PodClaw lifecycle.

    Responsibilities:
    - Create agent sessions
    - Route scheduled tasks to the correct agent
    - Track active sessions and prevent concurrent runs
    - Handle errors and record events
    - Run memory consolidation
    """

    def __init__(
        self,
        client_factory: ClientFactory,
        event_store: EventStore,
        memory_manager: MemoryManager,
    ):
        self.factory = client_factory
        self.events = event_store
        self.memory = memory_manager
        self._active_sessions: dict[str, str] = {}  # agent_name → session_id
        self._running = False
        self._session_lock = asyncio.Lock()

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        self._running = True
        logger.info("orchestrator_started")

    def stop(self) -> None:
        self._running = False
        self._active_sessions.clear()
        logger.info("orchestrator_stopped")

    # -----------------------------------------------------------------------
    # Agent Execution
    # -----------------------------------------------------------------------

    async def run_agent(self, agent_name: str, task: str | None = None) -> dict[str, Any]:
        """
        Execute a sub-agent cycle.

        Args:
            agent_name: One of the 8 sub-agent names
            task: Optional specific task override (default: use SKILL.md task)

        Returns:
            Session result dict with events, duration, etc.
        """
        # Acquire lock for check-then-set of _active_sessions
        async with self._session_lock:
            if not self._running:
                logger.warning("orchestrator_not_running", agent=agent_name)
                return {"status": "skipped", "reason": "orchestrator not running"}

            if agent_name in self._active_sessions:
                logger.warning("agent_already_running", agent=agent_name)
                return {"status": "skipped", "reason": "already running"}

            if agent_name not in AGENT_NAMES:
                logger.error("unknown_agent", agent=agent_name)
                return {"status": "error", "reason": f"unknown agent: {agent_name}"}

            # Reset rate limit counters for this agent's new session
            from podclaw.hooks.rate_limit_hook import reset_counters
            reset_counters(agent_name)

            session_id = str(uuid.uuid4())
            self._active_sessions[agent_name] = session_id

        # Release lock — agent execution is long-running
        start_time = datetime.now(timezone.utc)

        # Write session row to agent_sessions table
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
            # Pass session_id so hooks get proper context
            client = self.factory.create_client(agent_name, session_id=session_id)

            await client.connect()

            prompt = task or self._default_task(agent_name)

            # SDK handles hooks (can_use_tool, PreToolUse, PostToolUse) natively
            await client.query(prompt)
            tool_calls = 0
            response_text = ""
            result_message = None

            async for msg in client.receive_response():
                if isinstance(msg, ResultMessage):
                    result_message = msg
                    break
                if hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "ToolUseBlock":
                            tool_calls += 1
                        elif block_type == "TextBlock":
                            response_text += block.text

            # Use ResultMessage stats when available
            if result_message:
                result["num_turns"] = getattr(result_message, "num_turns", None)
                result["total_cost_usd"] = getattr(result_message, "total_cost_usd", None)
                result["session_id_sdk"] = getattr(result_message, "session_id", None)

            result["response"] = response_text[:2000]
            result["tool_calls"] = tool_calls

            # Log to daily memory
            await self.memory.append_daily(
                agent_name,
                f"Session {session_id[:8]}: {prompt[:100]}... → completed ({tool_calls} tool calls)"
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
            # Disconnect the client if it was created
            try:
                if 'client' in locals():
                    await client.disconnect()
            except Exception as e:
                logger.warning("client_disconnect_failed", error=str(e))

            end_time = datetime.now(timezone.utc)
            result["end_time"] = end_time.isoformat()
            result["duration_seconds"] = (end_time - start_time).total_seconds()
            async with self._session_lock:
                self._active_sessions.pop(agent_name, None)

            await self.events.record(
                agent_name=agent_name,
                event_type="session_end",
                payload=result,
                session_id=session_id,
            )

            # Update session row in agent_sessions table
            await self.events.update_session(
                session_id=session_id,
                status=result.get("status", "completed"),
                tool_calls=result.get("tool_calls", 0),
                tool_errors=0,
                error_log=result.get("error"),
            )

            # Record to audit_log for traceability
            await self.events.record_audit(
                actor_id=f"podclaw:{agent_name}",
                action="agent_session",
                resource_type="agent_session",
                resource_id=session_id,
                changes={"status": result.get("status", "completed"), "tool_calls": result.get("tool_calls", 0)},
                metadata={"agent": agent_name, "duration_seconds": result.get("duration_seconds")},
            )

        return result

    def _default_task(self, agent_name: str) -> str:
        """Generate default task prompt based on agent role."""
        tasks = {
            "researcher": "Analyze current market trends, competitor activity, and identify opportunities for new products. Update best_sellers.md and customer_insights.md.",
            "marketing": "Review current social media performance, create new content for upcoming campaigns, and schedule posts. Update marketing_calendar.md.",
            "designer": "Generate new product designs based on trending topics and best sellers. Follow the style guide in design_library.md.",
            "newsletter": "Review subscriber segments, create personalized email content, and prepare campaigns. Check newsletter_segments.md for targeting.",
            "cataloger": "Sync products with Printify, update pricing based on demand forecasts, and translate new listings.",
            "customer_manager": "Review pending tickets, respond to product reviews, and send retention emails to at-risk segments.",
            "seo_manager": "Audit meta tags, update sitemaps, research keywords, and optimize product descriptions for search.",
            "finance": "Generate daily revenue report, analyze margins, detect anomalies, and reconcile Stripe with database.",
        }
        return tasks.get(agent_name, f"Execute standard {agent_name} cycle.")

    # -----------------------------------------------------------------------
    # Memory Consolidation
    # -----------------------------------------------------------------------

    async def run_consolidation(self, soul_evolution=None) -> None:
        """Run the 23:30 UTC memory consolidation cycle, with optional soul review."""
        logger.info("consolidation_starting")
        await self.memory.run_consolidation()

        # Weekly soul review on Sundays
        if soul_evolution:
            from datetime import datetime, timezone
            if datetime.now(timezone.utc).weekday() == 6:  # Sunday
                await self._review_soul(soul_evolution)

    async def _review_soul(self, soul_evolution) -> None:
        """
        LLM (Sonnet) compares SOUL.md + recent MEMORY.md and proposes changes.
        Only runs during Sunday consolidation.
        """
        from podclaw.config import CONSOLIDATION_MODEL, CONSOLIDATION_MAX_TOKENS

        soul = self.memory.read_soul()
        memory = self.memory.read_memory()

        if not soul:
            return

        try:
            import anthropic
            client = anthropic.AsyncAnthropic()

            response = await client.messages.create(
                model=CONSOLIDATION_MODEL,
                max_tokens=CONSOLIDATION_MAX_TOKENS,
                system=(
                    "You are PodClaw's soul evolution reviewer. Compare the current SOUL.md "
                    "with recent memory/learnings. Decide if any section should be updated. "
                    "Respond with JSON: {\"action\": \"NO_CHANGES\"} or "
                    "{\"action\": \"PROPOSE\", \"section\": \"Section Name\", "
                    "\"proposed\": \"new content\", \"reasoning\": \"why\"}. "
                    "Only propose changes based on strong evidence from memory. "
                    "NEVER propose changes to Constraints or Escalation Rules."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"## Current SOUL.md\n{soul[:4000]}\n\n"
                        f"## Recent Memory\n{memory[-3000:]}\n\n"
                        "Should any section of SOUL.md be updated?"
                    ),
                }],
            )

            import json
            text = response.content[0].text.strip()
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
            "agents": AGENT_NAMES,
        }

    def get_agent_status(self, agent_name: str) -> dict[str, Any]:
        """Get status for a specific agent."""
        from podclaw.config import AGENT_MODELS
        return {
            "agent": agent_name,
            "running": agent_name in self._active_sessions,
            "session_id": self._active_sessions.get(agent_name),
            "model": AGENT_MODELS.get(agent_name),
            "tools": AGENT_TOOLS.get(agent_name, []),
        }
