"""
PodClaw — Sync Hook (PostToolUse)
====================================

Enforces Printful ↔ Supabase data integrity at the infrastructure level.

Handlers (all fire-and-forget, never block the agent):
- printful_create_product   → upsert skeleton row in products (draft, with pricing)
- printful_update_product   → patch changed fields (title, description, prices)
- printful_delete_product   → hard-DELETE product + children
- printful_cancel_order     → update order status in Supabase

This makes sync CODE-ENFORCED, not instruction-dependent. If the LLM budget
runs out before it calls supabase_insert, the skeleton row already exists.

NOTE: Printful has no separate "publish" step like Printify. Products are
managed directly via create/update. The publish handler was removed.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import asyncio

import httpx
import structlog

from podclaw.config import USD_TO_EUR_RATE
from podclaw.hooks._parse_output import parse_tool_output
from podclaw.pricing import engagement_price as _engagement_price_canonical

logger = structlog.get_logger(__name__)

_MAX_RETRIES = 3
_RETRY_BACKOFF = 1.0  # seconds


async def _with_retry(
    fn,
    *args,
    max_retries: int = _MAX_RETRIES,
    backoff: float = _RETRY_BACKOFF,
    context_msg: str = "sync_hook",
    **kwargs,
) -> httpx.Response | None:
    """Retry an async HTTP operation with exponential backoff.

    Returns the response on success, or None after all retries exhausted.
    Only retries on network errors and 5xx status codes.
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            resp = await fn(*args, **kwargs)
            if resp.status_code < 500:
                return resp
            last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except (httpx.ConnectError, httpx.TimeoutException, httpx.ReadError) as e:
            last_error = str(e)
        if attempt < max_retries - 1:
            delay = backoff * (2 ** attempt)
            logger.warning(
                f"{context_msg}_retry",
                attempt=attempt + 1,
                max=max_retries,
                delay=delay,
                error=last_error,
            )
            await asyncio.sleep(delay)
    logger.error(f"{context_msg}_retries_exhausted", attempts=max_retries, error=last_error)
    return None


# Child tables with product_id FK → products(id)
# NOTE: designs are NOT deleted — they cost money and are preserved in Storage.
# Designs are only unlinked (product_id = NULL) on product deletion.
_CHILD_TABLES = [
    "product_variants",
    "marketing_content",
    "wishlist_items",
    "cart_items",
]

# Tables to unlink (SET product_id = NULL) instead of deleting
_UNLINK_TABLES = ["designs"]


def sync_hook(supabase_url: str, supabase_key: str, event_queue=None) -> Callable:
    """
    Factory: creates a PostToolUse hook that syncs Printful state changes to Supabase.

    Handles:
    - printful_create_product  → upsert skeleton product row (draft) + insert variants + margin gate
    - printful_update_product  → patch changed fields to Supabase
    - printful_delete_product  → hard-delete product + children from Supabase
    - printful_cancel_order    → update order status in Supabase
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_output = input_data.get("tool_output", "")

        # --- printful_create_product → upsert skeleton product in Supabase ---
        if tool_name == "printful_create_product":
            await _sync_printful_create(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printful_update_product → patch changed fields in Supabase ---
        elif tool_name == "printful_update_product":
            await _sync_printful_update(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printful_delete_product → hard-delete from Supabase ---
        elif tool_name == "printful_delete_product":
            await _sync_printful_delete(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printful_cancel_order → update order status in Supabase ---
        elif tool_name == "printful_cancel_order":
            await _sync_printful_cancel_order(
                tool_input, tool_output, headers, supabase_url
            )

        return {}

    return _hook


# ---------------------------------------------------------------------------
# USD→EUR conversion factor — single source of truth in config.py
# ---------------------------------------------------------------------------
_USD_TO_EUR = USD_TO_EUR_RATE


def _engagement_price(cost_cents: int, title: str = "") -> int:
    """Delegate to canonical pricing engine in podclaw.pricing."""
    return _engagement_price_canonical(cost_cents, title)


def _infer_category(tags: list[str], title: str = "") -> str:
    """Infer product category from tags and title."""
    combined = " ".join(t.lower() for t in tags) + " " + title.lower()

    if any(k in combined for k in ("hoodie", "sweater", "sweatshirt", "pullover")):
        return "hoodies"
    if any(k in combined for k in ("t-shirt", "tee ", "tank top", "unisex")):
        return "t-shirts"
    if any(k in combined for k in ("mug", "11 oz", "15 oz", "11oz", "15oz")):
        return "mugs"
    if any(k in combined for k in ("phone case", "iphone", "samsung case")):
        return "phone-cases"
    if any(k in combined for k in ("poster", "paper", "print", "canvas")):
        return "posters"
    if any(k in combined for k in ("tote", "bag ", "bags")):
        return "bags"
    if any(k in combined for k in ("sticker",)):
        return "stickers"
    if any(k in combined for k in ("hat", "cap", "beanie")):
        return "hats"
    if any(k in combined for k in ("pillow", "blanket", "towel", "home & living")):
        return "home-decor"
    if any(k in combined for k in ("drinkware", "bottle", "tumbler")):
        return "drinkware"
    return "uncategorized"


async def _insert_variants(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    supabase_url: str,
    product_db_id: str,
    printful_id: str,
    variants: list[dict],
) -> int:
    """Build variant rows from Printful sync variant data and insert into product_variants.

    Returns the number of variants successfully inserted.
    """
    variant_rows = []
    for v in variants:
        if not isinstance(v, dict):
            continue
        vid = v.get("id") or v.get("variant_id")
        if not vid:
            continue
        v_price = v.get("retail_price") or v.get("price", 0)
        row: dict[str, Any] = {
            "product_id": product_db_id,
            "external_variant_id": str(vid),
            "title": v.get("name", v.get("title", "")),
            "size": v.get("size", ""),
            "color": v.get("color", ""),
            "price_cents": int(float(v_price) * 100) if isinstance(v_price, (int, float, str)) else 0,
            "sku": v.get("sku", ""),
            "is_enabled": True,
            "is_available": True,
        }
        variant_rows.append(row)

    logger.info(
        "sync_hook_variants_built",
        printful_id=printful_id,
        raw_variants=len(variants),
        valid_rows=len(variant_rows),
    )

    if not variant_rows:
        return 0

    try:
        vr = await client.post(
            f"{supabase_url}/rest/v1/product_variants",
            headers={**headers, "Prefer": "return=minimal"},
            json=variant_rows,
        )
        if vr.status_code < 400:
            logger.info(
                "sync_hook_variants_inserted",
                printful_id=printful_id,
                count=len(variant_rows),
            )
            return len(variant_rows)
        else:
            logger.warning(
                "sync_hook_variants_failed",
                printful_id=printful_id,
                status=vr.status_code,
                detail=vr.text[:200],
            )
            return 0
    except Exception as e:
        logger.error("sync_hook_variants_insert_error", printful_id=printful_id, error=str(e))
        return 0


async def _sync_printful_create(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful printful_create_product, upsert a skeleton product row in Supabase.

    Printful response format: {result: {id, external_id, name, variants: [...], ...}}
    """
    output = parse_tool_output(tool_output)
    if not output:
        return

    # Printful wraps in {result: ...}
    result = output.get("result", output) if isinstance(output, dict) else output
    if not isinstance(result, dict):
        return

    printful_id = result.get("id", "")
    if not printful_id:
        return

    title = result.get("name", result.get("title", "Untitled"))
    sync_product = result.get("sync_product", {})
    if isinstance(sync_product, dict) and sync_product.get("name"):
        title = sync_product["name"]

    # Extract sync variants
    sync_variants = result.get("sync_variants", result.get("variants", []))

    # Calculate pricing from variant costs (Printful costs are in USD)
    costs_usd = []
    for v in sync_variants:
        if not isinstance(v, dict):
            continue
        product_info = v.get("product", {})
        cost = product_info.get("price") if isinstance(product_info, dict) else None
        if cost:
            costs_usd.append(float(cost))

    min_cost_usd = min(costs_usd) if costs_usd else 0
    cost_eur = int(min_cost_usd * 100 * _USD_TO_EUR) if min_cost_usd else 0
    base_price = _engagement_price(cost_eur, title) if cost_eur > 0 else 2999

    # Infer category
    category = _infer_category([], title)

    row = {
        "provider_product_id": str(printful_id),
        "title": title,
        "description": "",
        "status": "draft",
        "currency": "EUR",
        "cost_cents": cost_eur,
        "base_price_cents": base_price,
        "images": [],
        "category": category,
    }

    try:
        upsert_headers = {
            **headers,
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await _with_retry(
                client.post,
                f"{supabase_url}/rest/v1/products",
                headers=upsert_headers,
                json=row,
                context_msg="sync_create_upsert",
            )
            if resp is None:
                logger.error("sync_hook_create_upsert_all_retries_failed", printful_id=printful_id)
                return
            if resp.status_code < 400:
                rows = resp.json()
                product_db_id = rows[0]["id"] if rows else None
                logger.info(
                    "sync_hook_product_auto_inserted",
                    printful_id=printful_id,
                    title=title[:60],
                    cost_eur=cost_eur,
                    price=base_price,
                )

                # Margin gate: alert finance if margin < 40%
                if cost_eur > 0 and base_price > 0:
                    margin = (base_price - cost_eur) / base_price
                    if margin < 0.40 and event_queue:
                        try:
                            from podclaw.event_queue import SystemEvent
                            from datetime import datetime as _dt, timezone as _tz
                            await event_queue.push(SystemEvent(
                                source="sync_hook",
                                event_type="margin_alert",
                                payload={
                                    "printful_id": printful_id,
                                    "title": title[:100],
                                    "cost_eur": cost_eur,
                                    "price": base_price,
                                    "margin_pct": round(margin * 100, 1),
                                },
                                created_at=_dt.now(_tz.utc),
                                wake_mode="now",
                                target_agent="finance",
                            ))
                            logger.warning("sync_hook_margin_alert",
                                           printful_id=printful_id, margin=round(margin * 100, 1))
                        except Exception as e:
                            logger.warning("sync_hook_margin_alert_push_failed", error=str(e))

                # Sync variants to product_variants table
                if product_db_id and sync_variants:
                    await _insert_variants(
                        client, headers, supabase_url,
                        product_db_id, str(printful_id), sync_variants,
                    )
            else:
                logger.warning(
                    "sync_hook_create_upsert_failed",
                    printful_id=printful_id,
                    status=resp.status_code,
                    detail=resp.text[:300],
                )
    except Exception as e:
        logger.error("sync_hook_create_error", printful_id=printful_id, error=str(e))


async def _sync_printful_update(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful printful_update_product, patch changed fields in Supabase."""
    output = parse_tool_output(tool_output)
    if not output:
        return

    printful_id = tool_input.get("product_id", "")
    if not printful_id:
        return

    # Build patch payload from tool_input
    patch: dict[str, Any] = {}
    sync_product = tool_input.get("sync_product", {})
    if isinstance(sync_product, dict):
        if sync_product.get("name"):
            patch["title"] = sync_product["name"]

    if not patch:
        return  # Nothing to sync

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await _with_retry(
                client.patch,
                f"{supabase_url}/rest/v1/products?provider_product_id=eq.{printful_id}",
                headers=headers,
                json=patch,
                context_msg="sync_update_patch",
            )
            if resp is None:
                logger.error("sync_hook_update_all_retries_failed", printful_id=printful_id)
                return
            if resp.status_code < 400:
                logger.info(
                    "sync_hook_product_auto_patched",
                    printful_id=printful_id,
                    fields=list(patch.keys()),
                )
            else:
                logger.warning(
                    "sync_hook_update_patch_failed",
                    printful_id=printful_id,
                    status=resp.status_code,
                    detail=resp.text[:300],
                )
    except Exception as e:
        logger.error("sync_hook_update_error", printful_id=printful_id, error=str(e))


async def _sync_printful_delete(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful Printful deletion, hard-delete the product from Supabase."""
    output = parse_tool_output(tool_output)
    # Printful delete returns empty on success (HTTP 200)
    # Accept if output is not an error dict
    if isinstance(output, dict) and output.get("error"):
        return

    printful_id = tool_input.get("product_id", "")
    if not printful_id:
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 1. Find the product DB id by provider_product_id
            find_url = (
                f"{supabase_url}/rest/v1/products"
                f"?provider_product_id=eq.{printful_id}&select=id"
            )
            resp = await client.get(find_url, headers=headers)
            if resp.status_code >= 400 or not resp.text:
                logger.warning(
                    "sync_hook_product_not_found",
                    printful_id=printful_id,
                )
                return

            products = resp.json()
            if not products:
                return

            product_id = products[0]["id"]

            # 2. Unlink designs (preserve them — they cost money)
            for table in _UNLINK_TABLES:
                unlink_url = f"{supabase_url}/rest/v1/{table}?product_id=eq.{product_id}"
                try:
                    await client.patch(
                        unlink_url,
                        headers=headers,
                        json={"product_id": None},
                    )
                except Exception:
                    pass  # Table may not have rows — OK

            # 3. Delete child table rows (ignore errors — some may not have rows)
            for table in _CHILD_TABLES:
                del_url = f"{supabase_url}/rest/v1/{table}?product_id=eq.{product_id}"
                try:
                    await client.delete(del_url, headers=headers)
                except Exception:
                    pass  # Child table may not have rows — OK

            # 4. Delete the product row itself
            del_url = f"{supabase_url}/rest/v1/products?id=eq.{product_id}"
            resp = await client.delete(del_url, headers=headers)

            if resp.status_code < 400:
                logger.info(
                    "sync_hook_product_deleted",
                    printful_id=printful_id,
                    product_id=product_id,
                )
            else:
                logger.error(
                    "sync_hook_delete_failed",
                    printful_id=printful_id,
                    product_id=product_id,
                    status=resp.status_code,
                    detail=resp.text[:200],
                )

    except Exception as e:
        logger.error(
            "sync_hook_error",
            printful_id=printful_id,
            error=str(e),
        )


async def _sync_printful_cancel_order(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful order cancellation, update order status in Supabase."""
    output = parse_tool_output(tool_output)
    if isinstance(output, dict) and output.get("error"):
        return

    order_id = tool_input.get("order_id", "")
    if not order_id:
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.patch(
                f"{supabase_url}/rest/v1/orders?external_order_id=eq.{order_id}",
                headers=headers,
                json={"status": "cancelled"},
            )
            if resp.status_code < 400:
                logger.info(
                    "sync_hook_order_cancelled",
                    order_id=order_id,
                )
            else:
                logger.warning(
                    "sync_hook_cancel_order_patch_failed",
                    order_id=order_id,
                    status=resp.status_code,
                    detail=resp.text[:200],
                )
    except Exception as e:
        logger.error("sync_hook_cancel_order_error", order_id=order_id, error=str(e))
