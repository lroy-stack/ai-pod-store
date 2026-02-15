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
)

logger = structlog.get_logger(__name__)

# Approved RPC functions (from Supabase migrations)
ALLOWED_RPC_FUNCTIONS = frozenset({
    "match_products",
    "match_product_embeddings",
    "match_designs",
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
    "web_search",
    "gemini_embed_text",
    "gemini_embed_batch",
    "jina_rerank",
})

# Tools that are always blocked
BLOCKED_TOOLS = frozenset({
    "supabase_drop_table",
    "supabase_truncate",
})


def init_security(supabase_client: Any) -> None:
    """Initialize with Supabase client for price lookups."""
    global _supabase_client
    _supabase_client = supabase_client


def _fetch_current_price(product_id: str) -> float | None:
    """Fetch current price from Supabase products table (sync, run in thread)."""
    if not _supabase_client or not product_id:
        return None
    try:
        result = (
            _supabase_client.table("products")
            .select("price")
            .eq("id", product_id)
            .single()
            .execute()
        )
        if result.data:
            return float(result.data["price"])
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
        amount = tool_input.get("amount", 0)
        if amount > REFUND_APPROVAL_THRESHOLD * 100:  # Stripe uses cents
            return _deny(
                f"Refund ${amount/100:.2f} exceeds ${REFUND_APPROVAL_THRESHOLD} threshold. "
                "Requires human approval."
            )

    # --- Price change checks ---
    if tool_name == "supabase_update":
        table = tool_input.get("table", "")
        data = tool_input.get("data", {})

        if table == "products" and "price" in data:
            new_price = data["price"]
            # Look up current price from DB (self-sufficient, no injection needed)
            filters = tool_input.get("filters", {})
            product_id = filters.get("id", "")
            old_price = await asyncio.to_thread(_fetch_current_price, product_id)

            if old_price and old_price > 0:
                change_pct = abs(new_price - old_price) / old_price * 100
                if change_pct > PRICE_CHANGE_MAX_PERCENT:
                    return _deny(
                        f"Price change {change_pct:.1f}% exceeds ±{PRICE_CHANGE_MAX_PERCENT}% limit. "
                        f"Old: €{old_price:.2f}, New: €{new_price:.2f}. Requires human approval."
                    )

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
