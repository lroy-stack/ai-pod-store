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
    "fal_generate": 0.05,
    "fal_upscale": 0.003,
    "fal_remove_bg": 0.02,
    "gemini_embed_text": 0.0,
    "gemini_embed_batch": 0.0,
    "resend_send": 0.001,
    "resend_send_batch": 0.005,
    "crawl_url": 0.0,
    "crawl_batch": 0.0,
    "extract_article": 0.0,
    "crawl_site": 0.0,
    "capture_screenshot": 0.0,
    "stripe_create_refund": 0.0,
    "stripe_list_charges": 0.0,
    "stripe_get_balance": 0.0,
    "stripe_get_revenue_report": 0.0,
    "stripe_list_disputes": 0.0,
    "stripe_get_invoice": 0.0,
    "stripe_list_payouts": 0.0,
    "printify_create": 0.0,
    "printify_get_product": 0.0,
    "printify_delete_product": 0.0,
    "printify_publish": 0.0,
    "printify_unpublish": 0.0,
    "printify_upload_image": 0.0,
    "printify_get_providers": 0.0,
    "printify_get_variants": 0.0,
    "printify_get_mockup": 0.0,
    "printify_list_products": 0.0,
    "printify_get_blueprints": 0.0,
    "printify_update": 0.0,
    "printify_get_orders": 0.0,
    "printify_get_order_costs": 0.0,
    "printify_get_shipping_profiles": 0.0,
    "printify_search_blueprints": 0.0,
    "printify_get_blueprint_detail": 0.0,
    "printify_get_gpsr": 0.0,
    "printify_list_shops": 0.0,
    "printify_get_shop": 0.0,
    "printify_create_order": 0.0,
    "printify_send_to_production": 0.0,
    "printify_cancel_order": 0.0,
    "printify_list_webhooks": 0.0,
    "printify_create_webhook": 0.0,
    "printify_delete_webhook": 0.0,
    "printify_list_uploads": 0.0,
    "supabase_query": 0.0,
    "supabase_insert": 0.0,
    "supabase_update": 0.0,
    "supabase_delete": 0.0,
    "supabase_rpc": 0.0,
    "supabase_vector_search": 0.0,
    "telegram_send": 0.0,
    "telegram_send_photo": 0.0,
    "telegram_broadcast": 0.0,
    "whatsapp_send": 0.001,
    "whatsapp_send_template": 0.001,
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
    cost_eur = session_cost_usd * PRINTIFY_USD_TO_EUR_RATE  # USD → EUR
    async with _cost_lock:
        new_total = await increment_daily_cost(agent_name, cost_eur)
        logger.info(
            "session_cost_recorded",
            agent=agent_name,
            cost_usd=session_cost_usd,
            cost_eur=cost_eur,
            daily_total_eur=new_total,
        )


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
