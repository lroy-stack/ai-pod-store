"""
PodClaw — Security Hook (PreToolUse)
======================================

Validates tool inputs and blocks destructive operations.
Separate from the coding harness security.py — this protects STORE operations.

High-risk actions requiring approval:
- Refunds > $100 (Stripe)
- Price changes > ±20% (Supabase) — fetches current price autonomously
- Bulk product deletions > 10 items
- Design moderation failures → quarantine
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import structlog

import re

from podclaw.config import (
    REFUND_APPROVAL_THRESHOLD,
    PRICE_CHANGE_MAX_PERCENT,
    BULK_DELETE_THRESHOLD,
    MINIMUM_MARKUP_MULTIPLIER,
)

logger = structlog.get_logger(__name__)

# Approved RPC functions (from Supabase migrations)
ALLOWED_RPC_FUNCTIONS = frozenset({
    # Vector search
    "match_products",
    "match_product_embeddings",
    "match_designs",
    # Aggregation (read-only)
    "get_category_distribution",
    "get_product_stats",
    "get_daily_revenue",
    "get_rfm_segments",
    # Usage tracking
    "increment_usage",
})

# Valid identifier regex (same as supabase_connector._TABLE_RE)
_RPC_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

# Supabase client (set via init_security)
_supabase_client: Any = None

# Tools that are always allowed (read-only)
READONLY_TOOLS = frozenset({
    "supabase_query",
    "supabase_vector_search",
    "stripe_list_charges",
    "stripe_get_balance",
    "stripe_get_revenue_report",
    "stripe_list_disputes",
    "stripe_get_invoice",
    "stripe_list_payouts",
    "printify_list_products",
    "printify_get_blueprints",
    "printify_get_product",
    "printify_get_providers",
    "printify_get_variants",
    "printify_get_mockup",
    "printify_get_orders",
    "printify_get_order_costs",
    "printify_get_shipping_profiles",
    "printify_search_blueprints",
    "printify_get_blueprint_detail",
    "printify_get_gpsr",
    "printify_list_shops",
    "printify_get_shop",
    "printify_list_webhooks",
    "printify_list_uploads",
    "web_search",
    "read_url",
    "search_images",
    "expand_query",
    "deduplicate_strings",
    "parallel_search_web",
    "capture_screenshot",
    "gemini_embed_text",
    "gemini_embed_batch",
    "jina_rerank",
})

# Tools that are always blocked
BLOCKED_TOOLS = frozenset({
    "supabase_drop_table",
    "supabase_truncate",
})

# Tables that agents must never write to
PROTECTED_TABLES = frozenset({
    "users", "orders", "order_items", "payments",
    "user_usage", "credit_transactions", "push_subscriptions",
    "referrals", "drip_queue",
    "messaging_channels", "user_messaging_links",
})


def init_security(supabase_client: Any) -> None:
    """Initialize with Supabase client for price lookups."""
    global _supabase_client
    _supabase_client = supabase_client


def _check_duplicate_title(title: str) -> str | None:
    """Check if a product with this title already exists (non-deleted). Returns id or None."""
    if not _supabase_client or not title:
        return None
    try:
        result = (
            _supabase_client.table("products")
            .select("id,status")
            .eq("title", title)
            .execute()
        )
        if result.data:
            for row in result.data:
                if row.get("status") != "deleted":
                    return row["id"]
    except Exception as e:
        logger.warning("security_dedup_check_failed", title=title, error=str(e))
    return None


def _fetch_current_price(product_id: str) -> int | None:
    """Fetch current price in EUR cents from products table."""
    if not _supabase_client or not product_id:
        return None
    try:
        result = (
            _supabase_client.table("products")
            .select("base_price_cents")
            .eq("id", product_id)
            .single()
            .execute()
        )
        if result.data and result.data.get("base_price_cents") is not None:
            return int(result.data["base_price_cents"])
    except Exception as e:
        logger.warning("security_price_lookup_failed", product_id=product_id, error=str(e))
    return None


async def security_hook(
    input_data: dict[str, Any],
    tool_use_id: Optional[str] = None,
    context: Optional[Any] = None,
) -> dict[str, Any]:
    """
    PreToolUse hook: validate inputs and block destructive operations.
    Returns {} to allow, or deny dict to block.
    """
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Always allow read-only tools
    if tool_name in READONLY_TOOLS:
        return {}

    # Always block destructive tools
    if tool_name in BLOCKED_TOOLS:
        return _deny(f"Tool '{tool_name}' is permanently blocked")

    # --- Refund checks ---
    if tool_name == "stripe_create_refund":
        amount = tool_input.get("amount")
        if amount is None or amount == 0:
            return _deny(
                "Full refunds require human approval. "
                "Specify an explicit amount in cents, or get admin authorization."
            )
        if amount > REFUND_APPROVAL_THRESHOLD * 100:  # Stripe uses cents
            return _deny(
                f"Refund ${amount / 100:.2f} exceeds ${REFUND_APPROVAL_THRESHOLD} threshold. "
                "Requires human approval."
            )

    # --- Price change checks ---
    if tool_name == "supabase_update":
        table = tool_input.get("table", "")
        data = tool_input.get("data", {})

        if table == "products" and "base_price_cents" in data:
            new_price_cents = data["base_price_cents"]
            filters = tool_input.get("filters", {})
            product_id = filters.get("id", "")
            old_price_cents = await asyncio.to_thread(_fetch_current_price, product_id)

            if old_price_cents and old_price_cents > 0:
                change_pct = abs(new_price_cents - old_price_cents) / old_price_cents * 100
                if change_pct > PRICE_CHANGE_MAX_PERCENT:
                    return _deny(
                        f"Price change {change_pct:.1f}% exceeds +/-{PRICE_CHANGE_MAX_PERCENT}% limit. "
                        f"Old: EUR {old_price_cents/100:.2f}, New: EUR {new_price_cents/100:.2f}."
                    )

            # Dynamic minimum price floor based on cost
            cost_cents = data.get("cost_cents")
            if cost_cents and cost_cents > 0:
                dynamic_floor = max(int(cost_cents * MINIMUM_MARKUP_MULTIPLIER), cost_cents + 200)
                if new_price_cents < dynamic_floor:
                    return _deny(
                        f"Price EUR {new_price_cents/100:.2f} below dynamic floor "
                        f"EUR {dynamic_floor/100:.2f} (cost EUR {cost_cents/100:.2f} × {MINIMUM_MARKUP_MULTIPLIER})."
                    )
            elif new_price_cents < 299:  # absolute safety net: EUR 2.99
                return _deny(f"Price EUR {new_price_cents/100:.2f} below absolute minimum EUR 2.99.")

    # --- Bulk deletion checks ---
    if tool_name in ("supabase_delete", "printify_delete_product"):
        # Detect batch from input structure
        ids = tool_input.get("ids", [])
        count = len(ids) if isinstance(ids, list) else tool_input.get("_batch_count", 1)
        if count > BULK_DELETE_THRESHOLD:
            return _deny(
                f"Bulk deletion of {count} items exceeds {BULK_DELETE_THRESHOLD} threshold. "
                "Requires human approval."
            )

    # --- RPC whitelist (defense-in-depth, supabase_connector also validates) ---
    if tool_name == "supabase_rpc":
        func_name = tool_input.get("function_name", "")
        if not _RPC_NAME_RE.match(func_name):
            return _deny(f"Invalid RPC function name format: {func_name}")
        if func_name not in ALLOWED_RPC_FUNCTIONS:
            return _deny(f"RPC function not in approved list: {func_name}")

    # --- Table-level access control for write operations ---
    if tool_name in ("supabase_insert", "supabase_update", "supabase_delete"):
        table = tool_input.get("table", "")
        if table in PROTECTED_TABLES:
            return _deny(f"Table '{table}' is protected from agent writes")

    # --- Validate new product inserts (price floor + dedup) ---
    if tool_name == "supabase_insert":
        table = tool_input.get("table", "")
        raw_data = tool_input.get("data", {})
        # Normalize: handle both single dict and list of dicts
        records = raw_data if isinstance(raw_data, list) else [raw_data]
        if table == "products":
            for record in records:
                if not isinstance(record, dict):
                    return _deny("Invalid product data format: expected dict")
                # Dedup check
                title = record.get("title", "")
                if title:
                    existing = await asyncio.to_thread(_check_duplicate_title, title)
                    if existing:
                        return _deny(
                            f"Product '{title}' already exists in DB "
                            f"(id={existing[:12]}…). Skip or use different title."
                        )
                # Dynamic price floor based on cost
                price = record.get("base_price_cents")
                cost = record.get("cost_cents")
                if price is not None:
                    if cost and cost > 0:
                        dynamic_floor = max(int(cost * MINIMUM_MARKUP_MULTIPLIER), cost + 200)
                        if price < dynamic_floor:
                            return _deny(
                                f"New product price EUR {price/100:.2f} below dynamic floor "
                                f"EUR {dynamic_floor/100:.2f} (cost EUR {cost/100:.2f} × {MINIMUM_MARKUP_MULTIPLIER})."
                            )
                    elif price < 299:  # absolute safety net: EUR 2.99
                        return _deny(f"New product price EUR {price/100:.2f} below absolute minimum EUR 2.99.")

    # --- Duplicate product check for Printify creates ---
    if tool_name == "printify_create":
        title = tool_input.get("title", "")
        if title and _supabase_client:
            existing = await asyncio.to_thread(
                _check_duplicate_title, title
            )
            if existing:
                return _deny(
                    f"Product with title '{title}' already exists in Supabase "
                    f"(id={existing[:12]}…, status may be draft/active). "
                    "Skip this product or use a different title."
                )

    # --- Order write operations: audit + validation ---
    if tool_name == "printify_create_order":
        line_items = tool_input.get("line_items", [])
        if not isinstance(line_items, list):
            return _deny("printify_create_order: line_items must be an array")
        total_qty = sum(item.get("quantity", 1) for item in line_items if isinstance(item, dict))
        if total_qty > 20:
            return _deny(
                f"Order with {total_qty} total items exceeds safety limit of 20. "
                "Requires human approval."
            )
        logger.info(
            "outbound_printify_order",
            tool=tool_name,
            line_items=len(line_items),
            total_quantity=total_qty,
        )

    if tool_name == "printify_send_to_production":
        order_id = tool_input.get("order_id", "")
        logger.warning(
            "printify_production_trigger",
            tool=tool_name,
            order_id=order_id,
            note="IRREVERSIBLE: order will be charged and produced",
        )

    # --- Webhook write operations: audit ---
    if tool_name in ("printify_create_webhook", "printify_delete_webhook"):
        logger.info(
            "outbound_printify_webhook",
            tool=tool_name,
            topic=tool_input.get("topic", ""),
            url=tool_input.get("url", ""),
            webhook_id=tool_input.get("webhook_id", ""),
        )

    # --- Audit trail for outbound messaging ---
    if tool_name in ("resend_send", "resend_send_batch"):
        recipients = tool_input.get("to", tool_input.get("emails", []))
        if isinstance(recipients, str):
            recipients = [recipients]
        elif isinstance(recipients, list):
            recipients = [e.get("to", "") if isinstance(e, dict) else str(e) for e in recipients]
        logger.info("outbound_email", recipients=recipients[:10], tool=tool_name)

    if tool_name in ("telegram_send", "telegram_send_photo", "telegram_broadcast"):
        chat_ids = tool_input.get("chat_id") or tool_input.get("chat_ids", [])
        logger.info("outbound_telegram", chat_ids=chat_ids, tool=tool_name)

    if tool_name in ("whatsapp_send", "whatsapp_send_template"):
        logger.info("outbound_whatsapp", to=tool_input.get("to"), tool=tool_name)

    return {}


def _deny(reason: str) -> dict[str, Any]:
    """Build a deny response."""
    logger.warning("security_hook_denied", reason=reason)
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
