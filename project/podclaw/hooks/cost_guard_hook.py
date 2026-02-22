"""
PodClaw — Cost Guard Hook (PreToolUse)
========================================

Tracks daily API call costs per agent and denies if budget exceeded.
Costs are estimated per tool call (actual billing comes from Claude API).

Uses Supabase agent_daily_costs table when available, falls back to in-memory.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import structlog

from podclaw.config import AGENT_DAILY_BUDGETS, DEFAULT_DAILY_BUDGET, PRINTIFY_USD_TO_EUR_RATE

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
    "web_search": 0.005,
    "read_url": 0.005,
    "search_images": 0.005,
    "expand_query": 0.005,
    "deduplicate_strings": 0.01,
    "parallel_search_web": 0.025,
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

# In-memory daily cost tracker (fallback): {date_str: {agent_name: total_cost}}
_daily_costs: dict[str, dict[str, float]] = {}

# Lock for in-memory cost tracking
_cost_lock = asyncio.Lock()

# Supabase client (set via init_cost_guard)
_supabase_client: Any = None


def init_cost_guard(supabase_client: Any) -> None:
    """Initialize with Supabase client for persistent cost tracking."""
    global _supabase_client
    _supabase_client = supabase_client


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _get_agent_cost_sync(agent_name: str) -> float | None:
    """Get current daily cost for an agent (sync, for thread pool)."""
    if not _supabase_client:
        return None
    today = _today_key()
    result = (
        _supabase_client.table("agent_daily_costs")
        .select("total_cost")
        .eq("agent_name", agent_name)
        .eq("date", today)
        .execute()
    )
    if result.data:
        return float(result.data[0]["total_cost"])
    return 0.0


async def _get_agent_cost(agent_name: str) -> float:
    """Get current daily cost for an agent."""
    if _supabase_client:
        try:
            result = await asyncio.to_thread(_get_agent_cost_sync, agent_name)
            if result is not None:
                return result
        except Exception as e:
            logger.warning("cost_guard_supabase_read_failed", error=str(e))

    # Fallback to in-memory
    today = _today_key()
    return _daily_costs.get(today, {}).get(agent_name, 0.0)


def _add_cost_sync(agent_name: str, cost: float) -> float | None:
    """Add cost and return new total (sync, for thread pool)."""
    if not _supabase_client:
        return None
    today = _today_key()
    result = (
        _supabase_client.table("agent_daily_costs")
        .select("total_cost")
        .eq("agent_name", agent_name)
        .eq("date", today)
        .execute()
    )
    if result.data:
        new_total = float(result.data[0]["total_cost"]) + cost
        _supabase_client.table("agent_daily_costs").update(
            {"total_cost": new_total}
        ).eq("agent_name", agent_name).eq("date", today).execute()
    else:
        new_total = cost
        _supabase_client.table("agent_daily_costs").insert({
            "agent_name": agent_name,
            "date": today,
            "total_cost": new_total,
        }).execute()
    return new_total


async def _add_cost(agent_name: str, cost: float) -> float:
    """Add cost and return new total.

    Caller MUST hold _cost_lock to prevent TOCTOU with _get_agent_cost.
    """
    if _supabase_client:
        try:
            result = await asyncio.to_thread(_add_cost_sync, agent_name, cost)
            if result is not None:
                return result
        except Exception as e:
            logger.warning("cost_guard_supabase_write_failed", error=str(e))

    # Fallback to in-memory (no lock here — caller holds _cost_lock)
    today = _today_key()
    if today not in _daily_costs:
        _daily_costs.clear()
        _daily_costs[today] = {}
    _daily_costs[today][agent_name] = _daily_costs[today].get(agent_name, 0.0) + cost
    return _daily_costs[today][agent_name]


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
        current_cost = await _get_agent_cost(agent_name)

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

        new_total = await _add_cost(agent_name, estimated_cost)
        logger.debug("cost_tracked", agent=agent_name, tool=tool_name, cost=estimated_cost, total=new_total)

        budget_usage = new_total / budget
        if budget_usage >= 0.80 and budget_usage < 0.85:  # only alert once in the 80-85% range
            logger.warning("budget_80pct_warning", agent=agent_name, usage_pct=round(budget_usage * 100, 1))

    return {}


def get_daily_costs() -> dict[str, float]:
    """Get current daily costs for all agents."""
    if _supabase_client:
        try:
            today = _today_key()
            result = (
                _supabase_client.table("agent_daily_costs")
                .select("agent_name, total_cost")
                .eq("date", today)
                .execute()
            )
            if result.data:
                return {row["agent_name"]: float(row["total_cost"]) for row in result.data}
        except Exception as e:
            logger.warning("cost_guard_supabase_query_failed", error=str(e))

    today = _today_key()
    return dict(_daily_costs.get(today, {}))


async def record_session_cost(agent_name: str, session_cost_usd: float) -> None:
    """Record SDK-reported LLM cost (USD) as part of daily budget tracking.

    Called by Orchestrator after each agent session completes.
    Converts USD to EUR using the standard rate before recording.
    """
    cost_eur = session_cost_usd * PRINTIFY_USD_TO_EUR_RATE  # USD → EUR
    async with _cost_lock:
        new_total = await _add_cost(agent_name, cost_eur)
        logger.info(
            "session_cost_recorded",
            agent=agent_name,
            cost_usd=session_cost_usd,
            cost_eur=cost_eur,
            daily_total_eur=new_total,
        )


def reset_costs() -> None:
    """Reset all cost tracking (for testing).

    Clears both in-memory tracker AND Supabase agent_daily_costs for today.
    """
    _daily_costs.clear()

    if _supabase_client:
        try:
            today = _today_key()
            _supabase_client.table("agent_daily_costs").delete().eq(
                "date", today
            ).execute()
            logger.info("cost_guard_reset", date=today, source="supabase+memory")
        except Exception as e:
            logger.warning("cost_guard_reset_supabase_failed", error=str(e))
