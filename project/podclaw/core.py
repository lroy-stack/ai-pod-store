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
        self._last_sdk_sessions: dict[str, str] = {}  # agent_name → SDK session_id (for resume)
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
            # Resume previous SDK session if available (session persistence)
            resume_sdk_session = self._last_sdk_sessions.get(agent_name)

            client = self.factory.create_client(
                agent_name,
                session_id=session_id,
                resume_sdk_session=resume_sdk_session,
            )

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

                # Persist SDK session ID for resume on next cycle
                sdk_session = getattr(result_message, "session_id", None)
                if sdk_session:
                    self._last_sdk_sessions[agent_name] = sdk_session

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

    async def run_agent_with_retry(
        self, agent_name: str, task: str | None = None, max_retries: int = 2,
    ) -> dict[str, Any]:
        """
        Execute a sub-agent with automatic retry on failure.

        Uses exponential backoff: 5s, 10s between retries.
        """
        for attempt in range(max_retries + 1):
            result = await self.run_agent(agent_name, task)
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

    def _default_task(self, agent_name: str) -> str:
        """Generate default task prompt based on agent role.

        IMPORTANT: Tasks use explicit tool-call verbs ("Call supabase_query",
        "Call web_search") so the LLM invokes MCP tools rather than generating
        answers from its own knowledge.  Passive verbs like "research" or
        "review" lead to zero tool usage.
        """
        tasks = {
            "researcher": (
                "Run the daily research cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT top 10 products by review_count DESC.\n"
                "2. Call supabase_query to SELECT order_items joined with orders for 7-day sales velocity.\n"
                "3. Call supabase_query to SELECT customer_segments for RFM distribution counts.\n"
                "4. Call web_search at least 10 times for: POD market trends, competitor pricing, "
                "seasonal opportunities 2-4 weeks out, trending niches, and emerging design styles.\n"
                "5. Write best_sellers.md with a top-10 products table and trending categories.\n"
                "6. Write customer_insights.md with fresh RFM segment counts and purchase patterns."
            ),
            "marketing": (
                "Run the content creation cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT from products ORDER BY review_count DESC LIMIT 5 "
                "to find the top products to promote.\n"
                "2. Call web_search at least 5 times to find current trending hashtags for: "
                "print-on-demand fashion, custom t-shirts, sustainable apparel, and POD design trends. "
                "Extract platform-specific hashtags for Instagram, Twitter, and Pinterest.\n"
                "3. Generate social media content for the top 3 products respecting platform limits "
                "(Instagram 2200 chars, Twitter 280 chars, Pinterest 500 chars).\n"
                "4. Call supabase_insert to store EACH content piece in the marketing_content table.\n"
                "5. Draft promotional email content for the top 3 products.\n"
                "6. Call telegram_send to schedule campaign messages for any planned flash sales.\n"
                "7. Write marketing_calendar.md with today's generated content summary."
            ),
            "designer": (
                "Run the daily design generation cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT products grouped by category with COUNT — identify "
                "categories with fewer than 3 active designs.\n"
                "2. Call web_search 3 times for trending POD design styles and color palettes.\n"
                "3. Call fal_generate for 5-10 new designs targeting trending categories and gaps.\n"
                "4. Run 5-point moderation on each (copyright, NSFW, spelling, resolution, colors).\n"
                "5. Call supabase_insert to store all approved designs in the designs table with "
                "full metadata (prompt, style, image_url, moderation_status).\n"
                "6. Write design_library.md with new entries."
            ),
            "newsletter": (
                "Run the campaign creation cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT from customer_segments for fresh RFM data.\n"
                "2. Create personalized email content for Champions (exclusive preview) and "
                "Loyal (new arrivals) segments.\n"
                "3. Set up A/B test with 2 subject line variants.\n"
                "4. Call resend_send_batch to send emails (max 100/call, 500 total). "
                "Include CAN-SPAM footer with unsubscribe link and "
                "POD AI Store, Friedrichstraße 123, 10117 Berlin, Germany.\n"
                "5. Call supabase_insert to log the campaign in agent_events."
            ),
            "cataloger": (
                "Run the new products cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT from designs WHERE product_id IS NULL AND "
                "moderation_status = 'approved'.\n"
                "2. For each approved design: call printify_get_blueprints to find product types, "
                "call printify_create_product with EUR pricing (Printify cost × 1.4).\n"
                "3. Generate descriptions in en/es/de.\n"
                "4. Call gemini_embed_text to create embeddings for search.\n"
                "5. Call supabase_insert to store product metadata.\n"
                "6. Write pricing_history.md with new products and prices. Max 50 creates per cycle."
            ),
            "customer_manager": (
                "Run the support cycle. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT from return_requests WHERE status = 'pending'.\n"
                "2. For each pending return: if amount ≤ €100, call stripe_create_refund; "
                "if > €100, flag for escalation.\n"
                "3. Call supabase_query to SELECT from product_reviews WHERE response IS NULL.\n"
                "4. For each unanswered review: generate localized response based on sentiment, "
                "then call supabase_update to store the response.\n"
                "5. Call resend_send to send retention emails to at-risk RFM segment.\n"
                "6. Write customer_insights.md with support issue counts and review sentiment. "
                "Never log customer PII."
            ),
            "seo_manager": (
                "Run the weekly SEO audit. You MUST call tools — do NOT answer from memory.\n"
                "1. Call supabase_query to SELECT from seo_meta_tags — check title ≤ 60 chars, "
                "description ≤ 160 chars, target keyword present.\n"
                "2. Call supabase_query to verify translations table has hreflang entries for en/es/de.\n"
                "3. Call web_search at least 10 times for POD long-tail keywords, competitor SEO "
                "strategies, and trending search terms in the print-on-demand space.\n"
                "4. Generate audit report with issues sorted by impact and action items.\n"
                "5. Call supabase_insert to log the audit in agent_events."
            ),
            "finance": (
                "Run the daily financial report. You MUST call tools — do NOT answer from memory.\n"
                "1. Call stripe_get_revenue_report for today's revenue data.\n"
                "2. Call supabase_query to SELECT SUM(total) from orders for DB totals — "
                "flag if difference with Stripe > €5.\n"
                "3. Call supabase_query to calculate gross margin per category (target ≥ 40%).\n"
                "4. Call stripe_list_disputes to check for new chargebacks.\n"
                "5. Call supabase_query to SELECT from return_requests to calculate refund rate — "
                "alert if > 5%.\n"
                "6. Call supabase_query to SELECT from agent_daily_costs — alert if > €5/day.\n"
                "7. Write pricing_history.md with daily margin analysis and reconciliation."
            ),
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
