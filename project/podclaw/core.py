"""
PodClaw — Orchestrator
========================

Central orchestrator that routes tasks to the 8 sub-agents.
Manages agent lifecycle, session tracking, and error handling.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from podclaw.config import AGENT_MODELS, AGENT_TOOLS, MAX_ACTIONS_PER_CYCLE
from podclaw.client_factory import ClientFactory
from podclaw.event_store import EventStore
from podclaw.memory_manager import MemoryManager

logger = structlog.get_logger(__name__)

AGENT_NAMES = [
    "researcher", "marketing", "designer", "newsletter",
    "cataloger", "customer_manager", "seo_manager", "finance",
]


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
        start_time = datetime.now(timezone.utc)

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
            client = self.factory.create_client(agent_name)

            prompt = task or self._default_task(agent_name)

            # Use streaming SDK pattern
            await client.query(prompt)
            tool_calls = 0
            response_text = ""
            async for msg in client.receive_response():
                if hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "ToolUseBlock":
                            tool_calls += 1
                            # Measure latency for metrics hook
                            t0 = time.monotonic()
                            tool_error = None
                            try:
                                # Tool execution happens inside the SDK
                                pass
                            except Exception as te:
                                tool_error = str(te)
                            latency_ms = (time.monotonic() - t0) * 1000

                            await self.events.record(
                                agent_name=agent_name,
                                event_type="tool_use",
                                payload={
                                    "tool": block.name,
                                    "input": block.input,
                                    "_agent_name": agent_name,
                                    "_latency_ms": latency_ms,
                                    "_error": tool_error,
                                },
                                session_id=session_id,
                            )
                        elif block_type == "TextBlock":
                            response_text += block.text

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
            end_time = datetime.now(timezone.utc)
            result["end_time"] = end_time.isoformat()
            result["duration_seconds"] = (end_time - start_time).total_seconds()
            self._active_sessions.pop(agent_name, None)

            await self.events.record(
                agent_name=agent_name,
                event_type="session_end",
                payload=result,
                session_id=session_id,
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

    async def run_consolidation(self) -> None:
        """Run the 23:30 UTC memory consolidation cycle."""
        logger.info("consolidation_starting")
        await self.memory.run_consolidation()

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
