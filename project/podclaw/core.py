"""
PodClaw — Orchestrator
========================

Central orchestrator that routes tasks to the 8 sub-agents.
Manages agent lifecycle, session tracking, and error handling.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog

from claude_agent_sdk import ResultMessage

from podclaw.config import AGENT_MODELS, AGENT_TOOLS, MAX_ACTIONS_PER_CYCLE
from podclaw.client_factory import ClientFactory
from podclaw.event_store import EventStore
from podclaw.memory_manager import MemoryManager
from podclaw.state_store import StateStore

logger = structlog.get_logger(__name__)

AGENT_NAMES = [
    "researcher", "marketing", "designer", "newsletter",
    "cataloger", "customer_manager", "seo_manager", "finance",
    "qa_inspector", "brand_manager",
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
        state_store: StateStore | None = None,
    ):
        self.factory = client_factory
        self.events = event_store
        self.memory = memory_manager
        self.state = state_store
        self._active_sessions: dict[str, str] = {}  # agent_name → session_id
        self._last_sdk_sessions: dict[str, str] = {}  # agent_name → SDK session_id (for resume)
        self._running = False
        self._session_lock = asyncio.Lock()

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        self._running = True
        asyncio.create_task(self._restore_sdk_sessions())
        logger.info("orchestrator_started")

    async def _restore_sdk_sessions(self) -> None:
        """Restore SDK session IDs from local SQLite state store."""
        if not self.state:
            return
        sessions = await self.state.get("sdk_sessions", {})
        if sessions:
            self._last_sdk_sessions.update(sessions)
            logger.info("sdk_sessions_restored", count=len(sessions))

    def stop(self) -> None:
        self._running = False
        self._active_sessions.clear()
        logger.info("orchestrator_stopped")

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

    async def run_agent(self, agent_name: str, task: str | None = None, force_fresh: bool = False) -> dict[str, Any]:
        """
        Execute a sub-agent cycle.

        Args:
            agent_name: One of the 8 sub-agent names
            task: Optional specific task override (default: use SKILL.md task)
            force_fresh: If True, start a new SDK session instead of resuming

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

            # Circuit breaker: block if agent has >= 3 errors in 24h
            if await self._check_circuit_breaker(agent_name):
                logger.warning("circuit_breaker_blocked", agent=agent_name)
                return {"status": "skipped", "reason": f"circuit breaker open for {agent_name} (>=3 errors in 24h)"}

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
            resume_sdk_session = None if force_fresh else self._last_sdk_sessions.get(agent_name)

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
                result["usage"] = getattr(result_message, "usage", None)

                # Persist SDK session ID for resume on next cycle
                sdk_session = getattr(result_message, "session_id", None)
                if sdk_session:
                    self._last_sdk_sessions[agent_name] = sdk_session
                    if self.state:
                        asyncio.create_task(
                            self.state.set("sdk_sessions", dict(self._last_sdk_sessions))
                        )

                # Record LLM cost in daily budget tracker
                llm_cost = getattr(result_message, "total_cost_usd", None)
                if llm_cost and llm_cost > 0:
                    from podclaw.hooks.cost_guard_hook import record_session_cost
                    await record_session_cost(agent_name, llm_cost)

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

        # Write mechanical session feedback (zero LLM cost)
        self._write_session_feedback(agent_name, result)

        # Incremental learning: extract key insights and persist to MEMORY.md
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

            # Extract task summary (what was asked)
            task_text = ""
            session_id = result.get("session_id", "?")
            # The task is logged in the daily memory, but we can extract from response
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
        self, agent_name: str, task: str | None = None, max_retries: int = 2,
        force_fresh: bool = False,
    ) -> dict[str, Any]:
        """
        Execute a sub-agent with automatic retry on failure.

        Uses exponential backoff: 5s, 10s between retries.
        Retries use session resume (not force_fresh) to avoid discarding context.
        """
        for attempt in range(max_retries + 1):
            retry_fresh = force_fresh if attempt == 0 else False
            result = await self.run_agent(agent_name, task, force_fresh=retry_fresh)
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

        NanoClaw pattern: define the GOAL, not the STEPS. The agent decides how.
        Each task includes:
        - Clear objective (1-2 sentences)
        - Anti-hallucination anchor ("You MUST call tools")
        - 2-3 key constraints inline
        - Verification checklist (self-correction)

        Keys that differ from agent_name (e.g. "cataloger_pricing") are used
        by the scheduler to dispatch cycle-specific tasks.
        """
        tasks = {
            "researcher": (
                "Research current sales trends, market opportunities, and cost benchmarks.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Check product performance, customer segments, and competitor activity.\n"
                "Look 2-4 weeks ahead for seasonal opportunities. All prices in EUR.\n"
                "Update best_sellers.md, customer_insights.md, and pricing_history.md Cost Benchmarks.\n\n"
                "CRITICAL: Write a 'Stock Needs for Designer' section at the TOP of best_sellers.md.\n"
                "Query designs without product_id and products by category to find gaps.\n"
                "Tell the Designer what product types need designs and what aspect ratios to use.\n"
                "Read product_specs.md Product Priorities for tier ordering.\n"
                "Consult catalog/INDEX.md for available EU products and margin targets.\n\n"
                "Before finishing, verify:\n"
                "- best_sellers.md has today's date and ≥5 trending categories\n"
                "- pricing_history.md Cost Benchmarks table has current date\n"
                "- If Printify product count ≠ Supabase product count, log SYNC MISMATCH at top of best_sellers.md\n"
                "- best_sellers.md has 'Stock Needs for Designer' table at the top"
            ),
            "marketing": (
                "Create multi-platform content to promote top products.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Find the best-selling products, research trending hashtags, and create content\n"
                "for Instagram, Twitter, Pinterest, and Telegram. Store all content in Supabase.\n"
                "All prices in EUR. Respect platform character limits.\n\n"
                "Before finishing, verify:\n"
                "- Each content piece stored in marketing_content table\n"
                "- marketing_calendar.md updated with today's content summary\n"
                "- No private/personal designs used in any content"
            ),
            "designer": (
                "Create new designs for trending product categories.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "FREE IMAGES FIRST. The internet has billions of royalty-free images — use them.\n"
                "AI generation costs real money ($0.003-$0.13 per image). Do NOT generate when you can source.\n\n"
                "1. Read best_sellers.md — check 'Stock Needs for Designer' for what products need designs\n"
                "2. Read product_specs.md — check Product Priorities (banned products, aspect ratios per tier)\n"
                "3. Search for TRANSPARENT PNG images FIRST:\n"
                "   - Call search_images with '{theme} transparent png site:pngimg.com OR site:cleanpng.com OR site:stickpng.com OR site:pngwing.com'\n"
                "   - These already have transparent backgrounds — NO bg removal needed!\n"
                "   - Fallback: search_images with '{theme} site:unsplash.com OR site:pexels.com' + fal_remove_bg\n"
                "4. For each: use image_url (NOT url), upload → if NOT already transparent: fal_remove_bg → gemini_check_image → insert\n"
                "5. ONLY if sourced < 5 approved: use fal_generate (cheap) or gemini_generate_image (expensive, last resort)\n"
                "6. ALWAYS specify aspect_ratio matching intended product type:\n"
                "   - Mugs/Totes/Stickers/Pillows → 1:1\n"
                "   - T-Shirts/Hoodies/Canvas → 3:4\n"
                "   - Phone Cases → 9:16\n"
                "7. All designs must pass gemini_check_image (score ≥ 7)\n"
                "8. Check catalog/INDEX.md for available product types and margin targets.\n"
                "   Prioritize products in Tier 1-2. Posters and AOP are ALLOWED per EU catalog.\n\n"
                "Target: ≥80% sourced. Minimum: ≥60% sourced.\n"
                "Read design_workflow.md for detailed procedures.\n\n"
                "Before finishing, verify:\n"
                "- All new designs have bg_removed_url populated\n"
                "- design_library.md updated with intended product types per design\n"
                "- Sourcing ratio: count sourced vs AI\n"
                "- Designs have correct aspect ratios (not all 1:1 squares)"
            ),
            "newsletter": (
                "Create and send personalized email campaigns by RFM segment.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Query customer segments, create personalized content for Champions and Loyal segments,\n"
                "set up A/B tests, and send via Resend. Include CAN-SPAM footer with unsubscribe link\n"
                "and POD AI Store, Friedrichstraße 123, 10117 Berlin, Germany.\n\n"
                "Before finishing, verify:\n"
                "- All emails include CAN-SPAM footer\n"
                "- Campaign logged in agent_events\n"
                "- newsletter_segments.md updated"
            ),
            # Cataloger Cycle 1 (08:00): New Products
            "cataloger": (
                "Create products from approved designs and publish them.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Read product_specs.md Product Priorities FIRST — respect tier ordering.\n"
                "Read design_library.md for intended product types and aspect ratios per design.\n\n"
                "CATALOG VALIDATION (MANDATORY before creating ANY product):\n"
                "Consult catalog/PRICING-MODEL.md to verify: (1) product exists in catalog,\n"
                "(2) EU provider is available, (3) margin target is achievable (min 40%).\n"
                "Skip products not in the EU catalog.\n\n"
                "Dimension validation (MANDATORY):\n"
                "- 1:1 designs → mugs, totes, stickers, pillows (NOT t-shirts or phone cases)\n"
                "- 3:4 designs → t-shirts, hoodies, canvas, posters (NOT phone cases)\n"
                "- 9:16 designs → phone cases only\n"
                "- Full coverage → AOP apparel, blankets, tapestries\n"
                "- Create Tier 1 products first, then Tier 2 (see product_specs.md)\n\n"
                "For each approved design without a product: select blueprint, pick EU provider,\n"
                "create in Printify, extract real costs, calculate EUR pricing (≥40% margin),\n"
                "save to Supabase with ALL mockup images and i18n descriptions, then publish.\n"
                "Use bg_removed_url when available. Minimum 4 color variants per product.\n"
                "Read pricing_history.md for Cost Benchmarks before pricing.\n"
                "For detailed procedures, Read product_workflow.md.\n\n"
                "CRITICAL DATA REQUIREMENTS (EVERY product):\n"
                "- description: PLAIN TEXT in English only. Example: 'Comfortable cotton t-shirt with bold design'\n"
                "- translations: JSONB example: {\"es\": {\"title\": \"Camiseta\", \"description\": \"...\"}, \"de\": {\"title\": \"T-Shirt\", \"description\": \"...\"}}\n"
                "  WRONG: putting {\"en\":\"...\",\"es\":\"...\"} in the description field\n"
                "- product_details: from printify_get_blueprint_detail — {\"material\": \"...\", \"care_instructions\": \"...\"}\n"
                "- product_variants: sync_hook auto-inserts on printify_create + publish. Query product_variants after publish to VERIFY.\n"
                "- images: JSONB array with ≥1 image from printify_get_mockup\n\n"
                "Before finishing, verify:\n"
                "- Every Printify product has a matching Supabase row (query both, compare counts)\n"
                "- All products have cost_cents AND base_price_cents with margin ≥40%\n"
                "- All products have ≥1 image in the images JSONB array\n"
                "- No URGENT alerts remain in pricing_history.md\n"
                "- All products exist in EU catalog (catalog/PRICING-MODEL.md)\n"
                "- No dimension-mismatched products"
            ),
            # Cataloger Cycle 2 (14:00): Pricing & Inventory
            "cataloger_pricing": (
                "Resolve pricing alerts and backfill missing costs.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Read pricing_history.md for Active Alerts from Finance — resolve URGENT first.\n"
                "Backfill any products missing cost_cents by fetching real costs from Printify.\n"
                "Adjust prices based on demand forecasts (±20% max). Log all changes.\n"
                "For detailed procedures, Read product_workflow.md.\n\n"
                "Before finishing, verify:\n"
                "- All URGENT alerts resolved or escalated\n"
                "- pricing_history.md updated with all changes\n"
                "- No products with cost_cents = NULL remain"
            ),
            # Cataloger Cycle 3 (18:00): Peak Prep
            "cataloger_peakprep": (
                "Prepare store for peak browsing hours.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Check that trending products from best_sellers.md are published and in stock.\n"
                "Archive anything out of stock. Publish any remaining drafts.\n"
                "Verify no URGENT alerts in pricing_history.md are unresolved."
            ),
            "customer_manager": (
                "Handle customer support: refunds, reviews, and retention.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Process pending return requests (auto-approve ≤ EUR 100, escalate > EUR 100).\n"
                "Respond to unanswered product reviews in the customer's language.\n"
                "Send retention emails to at-risk RFM segments. Never log customer PII.\n\n"
                "Before finishing, verify:\n"
                "- All pending return requests processed\n"
                "- All unanswered reviews have responses\n"
                "- customer_insights.md updated with issue counts and sentiment\n"
                "- No customer PII in any context file"
            ),
            "seo_manager": (
                "Audit SEO health and optimize for POD long-tail keywords.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Check meta tags (title ≤ 60, description ≤ 160), verify hreflang for en/es/de,\n"
                "research trending POD keywords, and generate an audit report sorted by impact.\n\n"
                "Before finishing, verify:\n"
                "- All meta tag violations flagged\n"
                "- Hreflang entries present for all locales\n"
                "- Audit stored in agent_events"
            ),
            "finance": (
                "Run daily financial analysis and margin verification.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Reconcile Stripe revenue with Supabase orders (flag discrepancy > EUR 5).\n"
                "For each product created/adjusted today, verify gross margin ≥ 40%.\n"
                "Use catalog/PRICING-MODEL.md as the authoritative pricing reference.\n"
                "Compare actual store prices against catalog margin targets.\n"
                "Write MARGIN_LOW (OPEN) or NEGATIVE_MARGIN (URGENT) alerts to pricing_history.md.\n"
                "Check chargebacks, refund rate (alert if > 5%), and agent daily costs.\n\n"
                "Before finishing, verify:\n"
                "- Daily Margin Summary appended to pricing_history.md\n"
                "- All products with margin < 40% have alerts written\n"
                "- Stripe ↔ DB reconciliation complete\n"
                "- Agent costs checked (agent_daily_costs table)"
            ),
            "qa_inspector": (
                "Verify quality and integrity of today's designs and products.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "Start by reading today's daily memory log to know what agents did today.\n"
                "Then check all designs created today: image_url present, bg_removed_url exists,\n"
                "quality_score >= 7. Check all products: printify_id present, images not empty,\n"
                "positive margins, currency = EUR.\n\n"
                "CRITICAL — Background removal visual check:\n"
                "Pick 5-10 designs with bg_removed_url and call gemini_check_image on the\n"
                "bg_removed_url (NOT image_url). Look for: partial bg removal, subject cut off,\n"
                "edge artifacts, nearly empty images. Mark failures with quality_score = 3.\n\n"
                "CRITICAL — Variant and Translation checks:\n"
                "Query product_variants grouped by product_id — report any active product with 0 variants.\n"
                "Query products WHERE translations = '{}' OR translations IS NULL — report missing i18n.\n"
                "Query products WHERE description LIKE '{%%' — report JSON in description field.\n"
                "For products with 0 variants: fetch from Printify (printify_get_product) and report the\n"
                "variant count there — if Printify has variants but Supabase doesn't, flag as SYNC BUG.\n\n"
                "CATALOG VALIDATION:\n"
                "Cross-reference products against catalog/PRICING-MODEL.md.\n"
                "Flag: (1) products not in catalog, (2) margins below catalog target, (3) wrong provider.\n\n"
                "Count products in Printify (printify_list_products) and Supabase (supabase_query).\n"
                "If counts differ, write SYNC MISMATCH at the top of qa_report.md.\n\n"
                "Write your full report to qa_report.md with:\n"
                "- Date and time\n"
                "- Design count + issues found\n"
                "- BG removal quality: how many passed/failed visual check\n"
                "- Product count + issues found\n"
                "- Variant status: N products with 0 variants, M products OK\n"
                "- Translation status: N products missing translations\n"
                "- Sync status (Printify count vs Supabase count)\n"
                "- Action items for other agents"
            ),
            "brand_manager": (
                "Audit brand consistency across all published products.\n"
                "You MUST call tools — do NOT answer from memory.\n\n"
                "1. Read brand_config.md FIRST — check neck label status\n"
                "2. If neck label status is 'Not configured' → SKIP neck label audit entirely\n"
                "   (no Printify Upload ID means there's nothing to apply)\n"
                "3. List all products via printify_list_products\n"
                "4. Only audit neck labels on APPAREL products (t-shirts, hoodies, tank tops, long sleeves)\n"
                "   Skip mugs, phone cases, posters, stickers, pillows, blankets — they don't have neck areas\n"
                "5. If neck label IS configured: verify it's in print_areas for apparel, apply where missing\n"
                "6. Verify packaging insert and gift message settings are active\n"
                "7. Update brand_config.md with audit results\n\n"
                "GUARDRAILS:\n"
                "- Max 50 product updates per cycle\n"
                "- NEVER remove existing print areas (front/back)\n"
                "- Only ADD or UPDATE the neck label placeholder\n"
                "- Do NOT attempt to apply neck labels if Printify Upload ID is missing\n\n"
                "Before finishing, verify:\n"
                "- All apparel products audited\n"
                "- brand_config.md updated with date, counts, and issues"
            ),
        }
        return tasks.get(agent_name, f"Execute standard {agent_name} cycle.")

    # -----------------------------------------------------------------------
    # Incremental Learning
    # -----------------------------------------------------------------------

    async def _extract_and_persist_learnings(
        self, agent_name: str, result: dict[str, Any]
    ) -> None:
        """Extract key learnings from an agent's response and persist to MEMORY.md.

        Uses Haiku for cheap extraction (~$0.001 per call). Only persists
        genuinely novel insights — not routine confirmations.
        Runs as a fire-and-forget task to avoid blocking agent return.
        """
        response = result.get("response", "")
        if len(response) < 100:
            return  # Too short to have meaningful learnings

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

            # Persist each learning to MEMORY.md
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
            # Non-critical — don't fail the agent run
            logger.debug("incremental_learning_failed", agent=agent_name, error=str(e))

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
        LLM compares SOUL.md + recent MEMORY.md and proposes changes.
        Only runs during Sunday consolidation.
        """
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
                    "NEVER propose changes to Constraints or Escalation Rules."
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
