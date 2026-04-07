"""
PodClaw — Production Governor
================================

Market-conditioned adaptive production control.

Computes daily production limits (products + designs) based on real market
signals — traffic, sales, quality, costs — and enforces them via a
PreToolUse deny hook.

Architecture:
  1. Scheduler job (05:55 UTC) → compute_daily_decision()
  2. Decision persisted → StateStore + governor_report.md + in-memory cache
  3. Hook reads cache at zero latency → ALLOW / DENY tool calls

Fail-mode: SAFE
  No cache → limit=1 product/day, AI image generation disabled.

Data quality modes:
  - "proxy": No real views data. Base = min(3, max(1, floor(S_7d / 3))).
  - "real": Views tracking active. Traffic scaling + anti-saturation.
"""

from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VISIT_TO_ORDER_RATIO = 50
COLD_START_DAYS = 14
COLD_START_PRODUCT_LIMIT = 3
INVESTIGATION_TRIGGER_DAYS = 30
INVESTIGATION_TRIGGER_PRODUCTS = 60
INVESTIGATION_CYCLE_DAYS = 3
ANTI_SAT_SOFT = 0.15
ANTI_SAT_HARD = 0.25
PROXY_SALES_DIVISOR = 3
BUDGET_PRESSURE_COST = 30.0   # EUR monthly threshold
BUDGET_PRESSURE_SALES = 10    # Monthly sales threshold
FAIL_SAFE_PRODUCT_LIMIT = 1
ASSUMED_MARGIN_EUR = 8.0       # Average gross margin per product (EUR)

# Traffic cap tiers (real data mode only)
_TRAFFIC_TIERS = [
    (100, 2),
    (300, 3),
    (800, 5),
]
_TRAFFIC_MAX = 8


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class MarketSignals:
    V: float = 0.0                   # Estimated visits (24h)
    I_avg: float = 0.0               # Avg impressions per product
    CTR_est: float = 0.0             # Estimated CTR (%)
    ATC_est: float = 0.0             # Estimated add-to-cart rate (%)
    S_7d: int = 0                    # Sales last 7 days
    R: float = 0.0                   # Design rejection rate (%)
    C_pd: float = 0.0               # Cost per design (EUR)
    N_active: int = 0               # Active product count
    category_sales_7d: dict[str, int] = field(default_factory=dict)
    data_quality: str = "proxy"     # "proxy" or "real"
    monthly_cost: float = 0.0       # Agent costs this month (EUR)
    monthly_sales: int = 0          # Orders this month
    days_since_first_product: int = 0
    total_products_ever: int = 0


@dataclass
class GovernorDecision:
    date: str = ""
    mode: str = "cold_start"        # cold_start | proxy | normal | frozen | investigation
    daily_product_limit: int = COLD_START_PRODUCT_LIMIT
    daily_design_limit: int = COLD_START_PRODUCT_LIMIT + 1
    category_boosts: dict[str, int] = field(default_factory=dict)
    freeze_until: str | None = None
    modifiers_applied: list[str] = field(default_factory=list)
    explanation: str = ""
    data_quality: str = "proxy"
    signals_snapshot: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Module state (in-memory, read by hook at zero latency)
# ---------------------------------------------------------------------------
_governor_cache: dict = {}
_governor_lock = asyncio.Lock()
_production_counters: dict[str, int] = {}
_counter_lock = asyncio.Lock()


def _deny(reason: str) -> dict:
    """Build a deny response matching PodClaw hook protocol."""
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


# ---------------------------------------------------------------------------
# Signal fetching
# ---------------------------------------------------------------------------
async def _fetch_signals(supabase_client, target_date: date | None = None) -> MarketSignals:
    """Query Supabase for market signals. Returns MarketSignals dataclass."""
    if target_date is None:
        target_date = date.today()

    signals = MarketSignals()

    if not supabase_client:
        return signals

    yesterday = (target_date - timedelta(days=1)).isoformat()
    seven_days_ago = (target_date - timedelta(days=7)).isoformat()
    month_start = target_date.replace(day=1).isoformat()

    try:
        import asyncio as _aio

        # 1. Active products count
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("products")
                .select("id", count="exact")
                .eq("status", "active")
                .execute()
            )
            signals.N_active = result.count or 0
        except Exception as e:
            logger.debug("governor_signal_products_fail", error=str(e))

        # 2. Sales last 7 days + category breakdown
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("product_daily_metrics")
                .select("product_id, orders, views, category")
                .gte("date", seven_days_ago)
                .lte("date", yesterday)
                .execute()
            )
            rows = result.data or []
            total_orders = sum(r.get("orders", 0) for r in rows)
            total_views = sum(r.get("views", 0) for r in rows)
            signals.S_7d = total_orders

            # Check if views data is real
            if total_views > 0:
                signals.data_quality = "real"
                signals.V = total_views / 7.0
                if signals.N_active > 0:
                    signals.I_avg = total_views / signals.N_active
                    signals.CTR_est = (total_orders / max(total_views, 1)) * 100
                signals.ATC_est = signals.CTR_est * 2.5
            else:
                signals.data_quality = "proxy"
                signals.V = total_orders * VISIT_TO_ORDER_RATIO / 7.0 if total_orders > 0 else 0
                if signals.N_active > 0:
                    signals.I_avg = (total_orders * VISIT_TO_ORDER_RATIO) / signals.N_active
                    signals.CTR_est = (total_orders / 7.0 / max(signals.N_active, 1)) * 100
                signals.ATC_est = signals.CTR_est * 2.5

            # Category sales breakdown
            cat_sales: dict[str, int] = {}
            for r in rows:
                cat = r.get("category", "")
                if cat:
                    cat_sales[cat] = cat_sales.get(cat, 0) + r.get("orders", 0)
            signals.category_sales_7d = cat_sales
        except Exception as e:
            logger.debug("governor_signal_metrics_fail", error=str(e))

        # 3. Design rejection rate (quality_score < 6 in last 7 days)
        try:
            total_scored = await _aio.to_thread(
                lambda: supabase_client.table("designs")
                .select("id", count="exact")
                .not_.is_("quality_score", "null")
                .gte("created_at", seven_days_ago)
                .execute()
            )
            rejected = await _aio.to_thread(
                lambda: supabase_client.table("designs")
                .select("id", count="exact")
                .lt("quality_score", 6)
                .gte("created_at", seven_days_ago)
                .execute()
            )
            total_count = total_scored.count or 0
            rejected_count = rejected.count or 0
            signals.R = (rejected_count / max(total_count, 1)) * 100
        except Exception as e:
            logger.debug("governor_signal_designs_fail", error=str(e))

        # 4. Cost per design (agent_daily_costs for designer, last 7 days)
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("agent_daily_costs")
                .select("total_cost_eur")
                .eq("agent_name", "designer")
                .gte("date", seven_days_ago)
                .lte("date", yesterday)
                .execute()
            )
            rows = result.data or []
            total_cost = sum(r.get("total_cost_eur", 0) for r in rows)

            # Count designs created in the same period
            designs_created = await _aio.to_thread(
                lambda: supabase_client.table("designs")
                .select("id", count="exact")
                .gte("created_at", seven_days_ago)
                .execute()
            )
            design_count = designs_created.count or 0
            signals.C_pd = total_cost / max(design_count, 1)
        except Exception as e:
            logger.debug("governor_signal_costs_fail", error=str(e))

        # 5. Days since first product
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("products")
                .select("created_at")
                .order("created_at")
                .limit(1)
                .execute()
            )
            if result.data:
                first_created = result.data[0].get("created_at", "")
                if first_created:
                    first_date = datetime.fromisoformat(first_created.replace("Z", "+00:00")).date()
                    signals.days_since_first_product = (target_date - first_date).days
        except Exception as e:
            logger.debug("governor_signal_first_product_fail", error=str(e))

        # 6. Total products ever created
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("products")
                .select("id", count="exact")
                .execute()
            )
            signals.total_products_ever = result.count or 0
        except Exception as e:
            logger.debug("governor_signal_total_products_fail", error=str(e))

        # 7. Monthly cost (all agents)
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("agent_daily_costs")
                .select("total_cost_eur")
                .gte("date", month_start)
                .lte("date", yesterday)
                .execute()
            )
            rows = result.data or []
            signals.monthly_cost = sum(r.get("total_cost_eur", 0) for r in rows)
        except Exception as e:
            logger.debug("governor_signal_monthly_cost_fail", error=str(e))

        # 8. Monthly sales
        try:
            result = await _aio.to_thread(
                lambda: supabase_client.table("product_daily_metrics")
                .select("orders")
                .gte("date", month_start)
                .lte("date", yesterday)
                .execute()
            )
            rows = result.data or []
            signals.monthly_sales = sum(r.get("orders", 0) for r in rows)
        except Exception as e:
            logger.debug("governor_signal_monthly_sales_fail", error=str(e))

    except Exception as e:
        logger.error("governor_fetch_signals_error", error=str(e))

    return signals


# ---------------------------------------------------------------------------
# Decision logic
# ---------------------------------------------------------------------------
async def compute_daily_decision(
    supabase_client,
    state_store,
    target_date: date | None = None,
) -> GovernorDecision:
    """Compute the daily production decision based on market signals."""
    if target_date is None:
        target_date = date.today()

    signals = await _fetch_signals(supabase_client, target_date)
    decision = GovernorDecision(
        date=target_date.isoformat(),
        data_quality=signals.data_quality,
        signals_snapshot=_signals_to_dict(signals),
    )
    modifiers: list[str] = []

    # --- Rule 0: Cold start ---
    if signals.days_since_first_product < COLD_START_DAYS or signals.total_products_ever < 5:
        decision.mode = "cold_start"
        decision.daily_product_limit = COLD_START_PRODUCT_LIMIT
        decision.daily_design_limit = COLD_START_PRODUCT_LIMIT + 1
        decision.explanation = (
            f"Cold start: {signals.days_since_first_product} days, "
            f"{signals.total_products_ever} products total. "
            f"Limit={COLD_START_PRODUCT_LIMIT}/day until day {COLD_START_DAYS} and 5 products."
        )
        modifiers.append("cold_start")
        decision.modifiers_applied = modifiers
        return decision

    # --- Rule 9: Kill condition / Investigation mode ---
    if (
        signals.days_since_first_product >= INVESTIGATION_TRIGGER_DAYS
        and signals.total_products_ever >= INVESTIGATION_TRIGGER_PRODUCTS
        and signals.S_7d == 0
    ):
        # Check if we're already in investigation mode
        state = await state_store.get("governor_state", {})
        inv_last_product = state.get("investigation_last_product_date", "")
        if inv_last_product:
            last_prod_date = date.fromisoformat(inv_last_product)
            days_since = (target_date - last_prod_date).days
            if days_since < INVESTIGATION_CYCLE_DAYS:
                decision.mode = "investigation"
                decision.daily_product_limit = 0
                decision.daily_design_limit = 1
                decision.explanation = (
                    f"Investigation mode: last product {days_since}d ago, "
                    f"next allowed in {INVESTIGATION_CYCLE_DAYS - days_since}d."
                )
                modifiers.append("investigation_waiting")
                decision.modifiers_applied = modifiers
                return decision

        decision.mode = "investigation"
        decision.daily_product_limit = 1
        decision.daily_design_limit = 2
        decision.explanation = (
            f"Investigation mode: {signals.days_since_first_product}d, "
            f"{signals.total_products_ever} products, 0 sales in 7d. "
            f"Limit=1 product every {INVESTIGATION_CYCLE_DAYS} days."
        )
        modifiers.append("investigation_active")
        decision.modifiers_applied = modifiers
        return decision

    # --- Rule 4: ATC freeze check (real data only) ---
    if signals.data_quality == "real":
        state = await state_store.get("governor_state", {})
        freeze_until_str = state.get("freeze_until", "")
        if freeze_until_str:
            freeze_until = datetime.fromisoformat(freeze_until_str)
            if datetime.now(timezone.utc) < freeze_until:
                decision.mode = "frozen"
                decision.daily_product_limit = 0
                decision.daily_design_limit = 1
                decision.freeze_until = freeze_until_str
                decision.explanation = (
                    f"ATC freeze active until {freeze_until_str}. "
                    f"ATC={signals.ATC_est:.1f}%, N_active={signals.N_active}."
                )
                modifiers.append("atc_freeze_active")
                decision.modifiers_applied = modifiers
                return decision

        # Check if new freeze should be triggered
        if signals.ATC_est < 2.0 and signals.N_active >= 10:
            freeze_until = datetime.now(timezone.utc) + timedelta(hours=48)
            await state_store.set("governor_state", {
                **state,
                "freeze_until": freeze_until.isoformat(),
            })
            decision.mode = "frozen"
            decision.daily_product_limit = 0
            decision.daily_design_limit = 1
            decision.freeze_until = freeze_until.isoformat()
            decision.explanation = (
                f"ATC freeze triggered: ATC={signals.ATC_est:.1f}% < 2%, "
                f"N_active={signals.N_active} >= 10. Frozen for 48h."
            )
            modifiers.append("atc_freeze_triggered")
            decision.modifiers_applied = modifiers
            return decision

    # --- Rule 1: Signal minimum (real data only) ---
    if signals.data_quality == "real" and signals.I_avg < 30:
        decision.mode = "normal"
        decision.daily_product_limit = 0
        decision.daily_design_limit = 1
        decision.explanation = (
            f"Signal minimum: I_avg={signals.I_avg:.0f} < 30. "
            f"Products not getting enough impressions."
        )
        modifiers.append("signal_minimum")
        decision.modifiers_applied = modifiers
        return decision

    # --- Compute base limit ---
    if signals.data_quality == "proxy":
        # Proxy mode: sales-gated, no traffic scaling
        decision.mode = "proxy"
        base = min(3, max(1, math.floor(signals.S_7d / PROXY_SALES_DIVISOR)))
        modifiers.append(f"proxy_base={base} (S_7d={signals.S_7d})")
    else:
        # Real data mode: traffic cap
        decision.mode = "normal"
        base = _TRAFFIC_MAX
        for threshold, cap in _TRAFFIC_TIERS:
            if signals.V < threshold:
                base = cap
                break
        modifiers.append(f"traffic_cap={base} (V={signals.V:.0f})")

        # Progressive anti-saturation (real data only)
        if signals.V > 0:
            sat_ratio = signals.N_active / max(signals.V, 1)
            if sat_ratio >= ANTI_SAT_HARD:
                modifiers.append(f"anti_sat_hard: ratio={sat_ratio:.2f}>={ANTI_SAT_HARD} → base=0")
                base = 0
            elif sat_ratio > ANTI_SAT_SOFT:
                old_base = base
                base = math.floor(base * 0.5)
                modifiers.append(f"anti_sat_soft: ratio={sat_ratio:.2f}>{ANTI_SAT_SOFT} → base {old_base}→{base}")

    # --- Apply modifiers ---

    # Rule 3: CTR penalty
    ctr_mod = 1.0
    if signals.CTR_est < 1.0:
        if signals.data_quality == "real":
            ctr_mod = 0.5
            modifiers.append(f"ctr_penalty_real: CTR={signals.CTR_est:.2f}% → ×0.5")
        else:
            ctr_mod = 0.75
            modifiers.append(f"ctr_penalty_proxy: CTR={signals.CTR_est:.2f}% → ×0.75")

    # Rule 6: Quality penalty
    quality_mod = 1.0
    if signals.R > 40:
        quality_mod = 0.5
        modifiers.append(f"quality_penalty: R={signals.R:.0f}% → ×0.5")

    # Rule 7: Cost penalty
    cost_mod = 1.0
    if signals.C_pd > ASSUMED_MARGIN_EUR * 0.25:
        cost_mod = 0.5
        modifiers.append(f"cost_penalty: C_pd=€{signals.C_pd:.2f} > €{ASSUMED_MARGIN_EUR * 0.25:.2f} → ×0.5")

    # Rule 10: Budget pressure
    budget_mod = 1.0
    if signals.monthly_cost > BUDGET_PRESSURE_COST and signals.monthly_sales < BUDGET_PRESSURE_SALES:
        budget_mod = 0.5
        modifiers.append(
            f"budget_pressure: M_cost=€{signals.monthly_cost:.0f}>€{BUDGET_PRESSURE_COST:.0f} "
            f"AND M_sales={signals.monthly_sales}<{BUDGET_PRESSURE_SALES} → ×0.5"
        )

    # Apply all modifiers to base
    product_limit = math.floor(base * ctr_mod * quality_mod * cost_mod * budget_mod)

    # Rule 5: Category boosts
    category_boosts: dict[str, int] = {}
    for cat, sales in signals.category_sales_7d.items():
        if sales >= 3:
            category_boosts[cat] = 1
            product_limit += 1
            modifiers.append(f"category_boost: {cat}={sales} sales → +1")

    decision.daily_product_limit = max(0, product_limit)
    decision.daily_design_limit = decision.daily_product_limit + 1
    decision.category_boosts = category_boosts
    decision.modifiers_applied = modifiers
    decision.explanation = (
        f"Mode={decision.mode}, data={signals.data_quality}. "
        f"Base={base}, modifiers=[ctr×{ctr_mod}, quality×{quality_mod}, "
        f"cost×{cost_mod}, budget×{budget_mod}]. "
        f"Boosts={len(category_boosts)}. "
        f"Final: {decision.daily_product_limit} products, {decision.daily_design_limit} designs."
    )

    return decision


def _signals_to_dict(s: MarketSignals) -> dict:
    """Convert MarketSignals to a JSON-serializable dict."""
    return {
        "V": round(s.V, 1),
        "I_avg": round(s.I_avg, 1),
        "CTR_est": round(s.CTR_est, 2),
        "ATC_est": round(s.ATC_est, 2),
        "S_7d": s.S_7d,
        "R": round(s.R, 1),
        "C_pd": round(s.C_pd, 2),
        "N_active": s.N_active,
        "category_sales_7d": s.category_sales_7d,
        "data_quality": s.data_quality,
        "monthly_cost": round(s.monthly_cost, 2),
        "monthly_sales": s.monthly_sales,
        "days_since_first_product": s.days_since_first_product,
        "total_products_ever": s.total_products_ever,
    }


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
async def persist_decision(
    decision: GovernorDecision,
    state_store,
    context_dir,
) -> None:
    """Persist decision to StateStore, in-memory cache, and governor_report.md."""
    global _governor_cache, _production_counters

    decision_dict = asdict(decision)

    # 1. StateStore
    await state_store.set("governor_decision", decision_dict)

    # 2. Update investigation state if applicable
    if decision.mode == "investigation" and decision.daily_product_limit > 0:
        state = await state_store.get("governor_state", {})
        state["investigation_last_product_date"] = decision.date
        await state_store.set("governor_state", state)

    # 3. In-memory cache (zero-latency for hook)
    async with _governor_lock:
        _governor_cache = decision_dict

    # 4. Reset daily counters
    async with _counter_lock:
        _production_counters = {"products_created": 0, "designs_generated": 0}

    # 5. Write governor_report.md for agents to read
    from pathlib import Path
    report_path = Path(context_dir) / "governor_report.md"
    try:
        s = decision.signals_snapshot
        report = f"""# Production Governor Report — {decision.date}

## Status
- **Mode**: {decision.mode}
- **Data Quality**: {decision.data_quality}
- **Daily Product Limit**: {decision.daily_product_limit}
- **Daily Design Limit**: {decision.daily_design_limit}

## Market Signals
- Estimated visits/day (V): {s.get('V', 0):.0f}
- Sales last 7 days (S_7d): {s.get('S_7d', 0)}
- Active products (N_active): {s.get('N_active', 0)}
- CTR estimate: {s.get('CTR_est', 0):.2f}%
- Design rejection rate: {s.get('R', 0):.0f}%
- Cost per design: €{s.get('C_pd', 0):.2f}
- Monthly cost: €{s.get('monthly_cost', 0):.0f}
- Monthly sales: {s.get('monthly_sales', 0)}

## Modifiers Applied
{chr(10).join(f'- {m}' for m in decision.modifiers_applied) if decision.modifiers_applied else '- None'}

## Category Boosts
{chr(10).join(f'- {cat}: +{boost}' for cat, boost in decision.category_boosts.items()) if decision.category_boosts else '- None'}

{f'## Freeze Until{chr(10)}{decision.freeze_until}' if decision.freeze_until else ''}

## Explanation
{decision.explanation}

---
*Generated by Production Governor at {datetime.now(timezone.utc).strftime("%H:%M UTC")}*
"""
        report_path.write_text(report)
        logger.info(
            "governor_report_written",
            path=str(report_path),
            mode=decision.mode,
            product_limit=decision.daily_product_limit,
        )
    except Exception as e:
        logger.error("governor_report_write_failed", error=str(e))

    logger.info(
        "governor_decision_persisted",
        date=decision.date,
        mode=decision.mode,
        product_limit=decision.daily_product_limit,
        design_limit=decision.daily_design_limit,
        data_quality=decision.data_quality,
        modifiers=len(decision.modifiers_applied),
    )


# ---------------------------------------------------------------------------
# Hook — PreToolUse deny chain
# ---------------------------------------------------------------------------
async def production_governor_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict:
    """PreToolUse hook that enforces daily production limits.

    Intercepts:
      - printify_create → products_created counter
      - fal_generate, gemini_generate_image → designs_generated counter

    Fail-safe: no cache → limit=1 product, AI generation disabled.
    """
    tool_name = input_data.get("tool_name", "")

    if tool_name == "printify_create":
        counter_key = "products_created"
        limit_key = "daily_product_limit"
    elif tool_name in ("fal_generate", "gemini_generate_image"):
        counter_key = "designs_generated"
        limit_key = "daily_design_limit"
    else:
        return {}

    cached = _governor_cache

    # --- FAIL-SAFE: no governor data available ---
    if not cached:
        if tool_name in ("fal_generate", "gemini_generate_image"):
            return _deny(
                "Governor not initialized — AI generation disabled (fail-safe mode)"
            )
        # Allow max 1 product creation in fail-safe
        async with _counter_lock:
            current = _production_counters.get("products_created", 0)
            if current >= FAIL_SAFE_PRODUCT_LIMIT:
                return _deny(
                    f"Governor not initialized — fail-safe limit ({FAIL_SAFE_PRODUCT_LIMIT}) reached"
                )
            _production_counters["products_created"] = current + 1
        return {}

    # --- Check freeze (AI tools only) ---
    freeze_until_str = cached.get("freeze_until")
    if freeze_until_str and tool_name in ("fal_generate", "gemini_generate_image"):
        try:
            freeze_until = datetime.fromisoformat(freeze_until_str)
            if datetime.now(timezone.utc) < freeze_until:
                return _deny(
                    f"AI generation frozen until {freeze_until_str} (ATC freeze)"
                )
        except (ValueError, TypeError):
            pass

    # --- Atomic check + increment ---
    limit = cached.get(limit_key, 0)
    async with _counter_lock:
        current = _production_counters.get(counter_key, 0)
        if current >= limit:
            mode = cached.get("mode", "unknown")
            return _deny(
                f"Governor limit reached: {counter_key}={current}/{limit} "
                f"(mode={mode}, data={cached.get('data_quality', '?')})"
            )
        _production_counters[counter_key] = current + 1

    return {}


# ---------------------------------------------------------------------------
# Initialization (startup restore)
# ---------------------------------------------------------------------------
async def init_governor(state_store) -> None:
    """Restore governor cache from StateStore at startup.

    Only restores if the stored decision is for today (same date).
    Otherwise leaves cache empty → fail-safe until scheduler computes.
    """
    global _governor_cache, _production_counters

    try:
        stored = await state_store.get("governor_decision")
        if stored and stored.get("date") == date.today().isoformat():
            async with _governor_lock:
                _governor_cache = stored
            logger.info(
                "governor_restored_from_state",
                date=stored.get("date"),
                mode=stored.get("mode"),
                product_limit=stored.get("daily_product_limit"),
            )
        else:
            logger.info(
                "governor_no_current_decision",
                stored_date=stored.get("date") if stored else None,
                today=date.today().isoformat(),
            )
    except Exception as e:
        logger.warning("governor_init_failed", error=str(e))

    # Always reset counters on startup
    async with _counter_lock:
        _production_counters = {"products_created": 0, "designs_generated": 0}
