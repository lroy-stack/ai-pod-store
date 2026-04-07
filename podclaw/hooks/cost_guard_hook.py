"""
PodClaw — Cost Guard Hook (PreToolUse)
========================================

Tracks daily API call costs per agent and denies if budget exceeded.
Costs are estimated per tool call (actual billing comes from Claude API).

Uses Redis INCRBYFLOAT for persistent cost tracking across restarts.
Key pattern: podclaw:cost:{agent}:{date} → FLOAT (total cost in EUR)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

from podclaw.config import (
    AGENT_DAILY_BUDGETS,
    DEFAULT_DAILY_BUDGET,
    GLOBAL_DAILY_SPEND_LIMIT_EUR,
    PRINTIFY_USD_TO_EUR_RATE,
)
from podclaw.redis_store import (
    increment_daily_cost,
    get_daily_cost,
    get_all_daily_costs,
    reset_daily_costs,
    init_redis,
)

logger = structlog.get_logger(__name__)

# Estimated cost per tool call (EUR) — conservative estimates
TOOL_COSTS: dict[str, float] = {
    # FAL (paid per call)
    "fal_generate_image": 0.05,
    "fal_upscale_image": 0.003,
    "fal_remove_background": 0.02,
    "fal_get_generation_status": 0.0,
    # Gemini
    "gemini_embed_text": 0.0,
    "gemini_embed_batch": 0.0,
    "gemini_generate_image": 0.13,
    "gemini_check_image_quality": 0.001,
    # Resend
    "resend_send_email": 0.001,
    "resend_send_batch": 0.005,
    "resend_list_emails": 0.0,
    "resend_get_delivery_stats": 0.0,
    # Crawl4AI (free — self-hosted)
    "crawl_url": 0.0,
    "crawl_batch": 0.0,
    "extract_article": 0.0,
    "crawl_site": 0.0,
    "capture_screenshot": 0.0,
    # Stripe (free — read + refund)
    "stripe_create_refund": 0.0,
    "stripe_list_charges": 0.0,
    "stripe_get_balance": 0.0,
    "stripe_get_revenue_report": 0.0,
    "stripe_list_disputes": 0.0,
    "stripe_get_invoice": 0.0,
    "stripe_list_payouts": 0.0,
    # Printful (free — all API calls)
    "printful_get_catalog": 0.0,
    "printful_get_catalog_product": 0.0,
    "printful_get_printfiles": 0.0,
    "printful_list_products": 0.0,
    "printful_get_product": 0.0,
    "printful_create_product": 0.0,
    "printful_update_product": 0.0,
    "printful_delete_product": 0.0,
    "printful_upload_file": 0.0,
    "printful_get_file": 0.0,
    "printful_create_mockup_task": 0.0,
    "printful_get_mockup_result": 0.0,
    "printful_create_order": 0.0,
    "printful_get_order": 0.0,
    "printful_cancel_order": 0.0,
    "printful_calculate_shipping": 0.0,
    "printful_list_webhooks": 0.0,
    "printful_setup_webhook": 0.0,
    # Supabase (free — self-hosted)
    "supabase_query": 0.0,
    "supabase_insert": 0.0,
    "supabase_update": 0.0,
    "supabase_delete": 0.0,
    "supabase_rpc": 0.0,
    "supabase_vector_search": 0.0,
    "supabase_upload_image": 0.0,
    "supabase_count": 0.0,
    # SVG Renderer (free — self-hosted)
    "svg_render_png": 0.0,
    "svg_composite_layers": 0.0,
}

# Lock for atomic check-and-increment operations
_cost_lock = asyncio.Lock()

# Supabase client (set via init_cost_guard)
_supabase_client: Any = None


def init_cost_guard(supabase_client: Any) -> None:
    """Initialize with Supabase client and Redis."""
    global _supabase_client
    _supabase_client = supabase_client
    init_redis()  # Initialize Redis connection pool


async def cost_guard_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """
    PreToolUse hook: enforce daily budget per agent.

    The entire check-and-increment is atomic under _cost_lock to prevent
    TOCTOU: two concurrent hooks both passing the budget check before either
    increments the counter.
    """
    tool_name = input_data.get("tool_name", "")
    agent_name = input_data.get("_agent_name", "unknown")

    estimated_cost = TOOL_COSTS.get(tool_name, 0.001)
    budget = AGENT_DAILY_BUDGETS.get(agent_name, DEFAULT_DAILY_BUDGET)

    # Atomic check-and-increment under lock
    async with _cost_lock:
        # Global daily spend limit (sum of all agents)
        all_costs = await get_all_daily_costs()
        global_total = sum(all_costs.values())

        if global_total + estimated_cost > GLOBAL_DAILY_SPEND_LIMIT_EUR:
            reason = (
                f"Global daily spend limit exceeded: "
                f"€{global_total:.4f} + €{estimated_cost:.4f} > €{GLOBAL_DAILY_SPEND_LIMIT_EUR:.2f} global cap"
            )
            logger.critical("global_spend_limit_denied", total=global_total, limit=GLOBAL_DAILY_SPEND_LIMIT_EUR)
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }

        current_cost = await get_daily_cost(agent_name)

        if current_cost + estimated_cost > budget:
            reason = (
                f"Agent '{agent_name}' daily budget exceeded: "
                f"€{current_cost:.4f} + €{estimated_cost:.4f} > €{budget:.2f} limit"
            )
            logger.warning("cost_guard_denied", agent=agent_name, cost=current_cost, budget=budget)
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }

        new_total = await increment_daily_cost(agent_name, estimated_cost)
        logger.debug("cost_tracked", agent=agent_name, tool=tool_name, cost=estimated_cost, total=new_total)

        budget_usage = new_total / budget
        if budget_usage >= 0.80 and budget_usage < 0.85:  # only alert once in the 80-85% range
            logger.warning("budget_80pct_warning", agent=agent_name, usage_pct=round(budget_usage * 100, 1))

    return {}


def get_daily_costs() -> dict[str, float]:
    """
    Get current daily costs for all agents (synchronous wrapper).

    Note: This is deprecated. Use async get_all_daily_costs() from redis_store instead.
    """
    logger.warning("get_daily_costs_deprecated", reason="Use async get_all_daily_costs() instead")
    return {}


async def record_session_cost(agent_name: str, session_cost_usd: float) -> None:
    """Record SDK-reported LLM cost (USD) as part of daily budget tracking.

    Called by Orchestrator after each agent session completes.
    Converts USD to EUR using the standard rate before recording.
    """
    cost_eur = session_cost_usd * PRINTIFY_USD_TO_EUR_RATE  # USD → EUR (alias of USD_TO_EUR_RATE)
    async with _cost_lock:
        new_total = await increment_daily_cost(agent_name, cost_eur)
        logger.info(
            "session_cost_recorded",
            agent=agent_name,
            cost_usd=session_cost_usd,
            cost_eur=cost_eur,
            daily_total_eur=new_total,
        )


async def get_daily_spent() -> float:
    """Return total EUR spent today across all agents.

    Used by OrchestratorStartup to show budget remaining in system context.
    """
    try:
        all_costs = await get_all_daily_costs()
        return sum(all_costs.values())
    except Exception:
        return 0.0


async def reset_costs() -> None:
    """Reset all cost tracking (for testing).

    Clears Redis cost keys for today and optionally Supabase agent_daily_costs.
    """
    await reset_daily_costs()

    if _supabase_client:
        try:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            _supabase_client.table("agent_daily_costs").delete().eq("date", today).execute()
            logger.info("cost_guard_reset_supabase", date=today)
        except Exception as e:
            logger.warning("cost_guard_reset_supabase_failed", error=str(e))
