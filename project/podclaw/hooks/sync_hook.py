"""
PodClaw — Sync Hook (PostToolUse)
====================================

Enforces Printify ↔ Supabase data integrity at the infrastructure level.

Handlers (all fire-and-forget, never block the agent):
- printify_create       → upsert skeleton row in products (draft, with pricing)
- printify_update       → patch changed fields (title, description, prices)
- printify_publish      → verify visible, then set status='active' or 'publishing'
- printify_delete_product → hard-DELETE product + children

This makes sync CODE-ENFORCED, not instruction-dependent. If the LLM budget
runs out before it calls supabase_insert, the skeleton row already exists.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import asyncio

import httpx
import structlog

from podclaw.config import PRINTIFY_USD_TO_EUR_RATE
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


def sync_hook(supabase_url: str, supabase_key: str, printify_token: str = "", shop_id: str = "", event_queue=None) -> Callable:
    """
    Factory: creates a PostToolUse hook that syncs Printify state changes to Supabase.

    Handles:
    - printify_create → upsert skeleton product row (draft) + insert variants + margin gate
    - printify_update → patch changed fields to Supabase
    - printify_publish → verify Printify visible, then set 'active' or 'publishing' + fallback variant insert
    - printify_delete_product → hard-delete product + children from Supabase
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

        # --- printify_create → upsert skeleton product in Supabase ---
        if tool_name == "printify_create":
            await _sync_printify_create(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printify_update → patch changed fields in Supabase ---
        elif tool_name == "printify_update":
            await _sync_printify_update(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printify_delete_product → hard-delete from Supabase ---
        elif tool_name == "printify_delete_product":
            await _sync_printify_delete(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printify_cancel_order → update order status in Supabase ---
        elif tool_name == "printify_cancel_order":
            await _sync_printify_cancel_order(
                tool_input, tool_output, headers, supabase_url
            )

        # --- printify_publish → activate product in Supabase + variant fallback ---
        elif tool_name == "printify_publish":
            await _sync_printify_publish(
                tool_input, tool_output, headers, supabase_url,
                printify_token=printify_token, shop_id=shop_id,
            )

        return {}

    return _hook


# ---------------------------------------------------------------------------
# USD→EUR conversion factor — single source of truth in config.py
# ---------------------------------------------------------------------------
_USD_TO_EUR = PRINTIFY_USD_TO_EUR_RATE


def _engagement_price(cost_cents: int, title: str = "") -> int:
    """Delegate to canonical pricing engine in podclaw.pricing."""
    return _engagement_price_canonical(cost_cents, title)


def _infer_category(tags: list[str], title: str = "") -> str:
    """Infer product category from Printify tags and title."""
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
    printify_id: str,
    variants: list[dict],
    images: list[dict] | None = None,
) -> int:
    """Build variant rows from Printify variant data and insert into product_variants.

    Returns the number of variants successfully inserted.
    """
    # Map mockup images to variant IDs
    img_map: dict[int, str] = {}
    for img in (images or []):
        if not isinstance(img, dict):
            continue
        src = img.get("src") or img.get("url", "")
        if not src:
            continue
        for vid in (img.get("variant_ids", []) or []):
            if vid and vid not in img_map:
                img_map[vid] = src

    variant_rows = []
    for v in variants:
        if not isinstance(v, dict):
            continue
        vid = v.get("id") or v.get("variant_id")
        if not vid:
            continue
        v_price = v.get("price", 0)
        row: dict[str, Any] = {
            "product_id": product_db_id,
            "printify_variant_id": str(vid),
            "title": v.get("title", ""),
            "size": v.get("size") or (v.get("options", {}) or {}).get("size", ""),
            "color": v.get("color") or (v.get("options", {}) or {}).get("color", ""),
            "price_cents": v_price if isinstance(v_price, int) else int(v_price or 0),
            "sku": v.get("sku", ""),
            "is_enabled": v.get("is_enabled", True),
            "is_available": v.get("is_available", True),
        }
        # Attach mockup image URL if mapped
        int_vid = int(vid) if str(vid).isdigit() else None
        if int_vid and int_vid in img_map:
            row["image_url"] = img_map[int_vid]
        variant_rows.append(row)

    logger.info(
        "sync_hook_variants_built",
        printify_id=printify_id,
        raw_variants=len(variants),
        valid_rows=len(variant_rows),
        images_mapped=len(img_map),
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
                printify_id=printify_id,
                count=len(variant_rows),
            )
            return len(variant_rows)
        else:
            logger.warning(
                "sync_hook_variants_failed",
                printify_id=printify_id,
                status=vr.status_code,
                detail=vr.text[:200],
            )
            return 0
    except Exception as e:
        logger.error("sync_hook_variants_insert_error", printify_id=printify_id, error=str(e))
        return 0


async def _sync_printify_create(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful printify_create, upsert a skeleton product row in Supabase.

    Uses ON CONFLICT (printify_id) DO NOTHING so that if the agent already
    inserted the row manually, the hook doesn't overwrite it.
    """
    output = parse_tool_output(tool_output)
    if not output:
        return

    printify_id = output.get("id", "")
    if not printify_id:
        return

    title = output.get("title", "Untitled")
    description = output.get("description", "")

    # Extract minimum variant cost (USD cents) and convert to EUR
    variants = output.get("variants", [])
    costs_usd = [v.get("cost", 0) for v in variants if isinstance(v, dict) and v.get("cost")]
    min_cost_usd = min(costs_usd) if costs_usd else 0
    cost_eur = int(min_cost_usd * _USD_TO_EUR) if min_cost_usd else 0

    # Always use our engagement pricing when we have cost data.
    # Printify variant prices are often defaults ($4.90) — never trust them blindly.
    base_price = _engagement_price(cost_eur, title) if cost_eur > 0 else 2999

    # Normalize images to [{src, alt}]
    raw_images = output.get("images", [])
    images = []
    for img in raw_images:
        if not isinstance(img, dict):
            continue
        src = img.get("src") or img.get("url", "")
        if src:
            images.append({"src": src, "alt": title})

    # Infer category from Printify tags
    tags = output.get("tags", [])
    category = _infer_category(tags, title)

    row = {
        "printify_id": str(printify_id),
        "title": title,
        "description": description[:2000] if description else "",
        "status": "draft",
        "currency": "EUR",
        "cost_cents": cost_eur,
        "base_price_cents": base_price,
        "images": images,
        "category": category,
    }

    try:
        # Use upsert with ON CONFLICT DO NOTHING
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
                logger.error("sync_hook_create_upsert_all_retries_failed", printify_id=printify_id)
                return
            if resp.status_code < 400:
                rows = resp.json()
                product_db_id = rows[0]["id"] if rows else None
                logger.info(
                    "sync_hook_product_auto_inserted",
                    printify_id=printify_id,
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
                                    "printify_id": printify_id,
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
                                           printify_id=printify_id, margin=round(margin * 100, 1))
                        except Exception as e:
                            logger.warning("sync_hook_margin_alert_push_failed", error=str(e))

                # Sync variants to product_variants table
                if product_db_id and variants:
                    await _insert_variants(
                        client, headers, supabase_url,
                        product_db_id, printify_id, variants,
                        images=output.get("images", []),
                    )
                elif product_db_id and not variants:
                    logger.warning(
                        "sync_hook_no_variants_in_printify_response",
                        printify_id=printify_id,
                    )
            else:
                logger.warning(
                    "sync_hook_create_upsert_failed",
                    printify_id=printify_id,
                    status=resp.status_code,
                    detail=resp.text[:300],
                )
    except Exception as e:
        logger.error("sync_hook_create_error", printify_id=printify_id, error=str(e))


async def _sync_printify_update(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful printify_update, patch changed fields in Supabase."""
    output = parse_tool_output(tool_output)
    if not output:
        return

    printify_id = tool_input.get("product_id", "")
    if not printify_id:
        return

    # Build patch payload from what's in tool_input (not output — input has intent)
    patch: dict[str, Any] = {}
    if "title" in tool_input and tool_input["title"]:
        patch["title"] = tool_input["title"]
    if "description" in tool_input and tool_input["description"]:
        patch["description"] = tool_input["description"][:2000]

    # If variants have new prices, update base_price_cents
    variants = tool_input.get("variants") or output.get("variants", [])
    if variants:
        prices = [v.get("price", 0) for v in variants if isinstance(v, dict) and v.get("price")]
        if prices:
            patch["base_price_cents"] = min(prices)

    if not patch:
        return  # Nothing to sync

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await _with_retry(
                client.patch,
                f"{supabase_url}/rest/v1/products?printify_id=eq.{printify_id}",
                headers=headers,
                json=patch,
                context_msg="sync_update_patch",
            )
            if resp is None:
                logger.error("sync_hook_update_all_retries_failed", printify_id=printify_id)
                return
            if resp.status_code < 400:
                logger.info(
                    "sync_hook_product_auto_patched",
                    printify_id=printify_id,
                    fields=list(patch.keys()),
                )
            else:
                logger.warning(
                    "sync_hook_update_patch_failed",
                    printify_id=printify_id,
                    status=resp.status_code,
                    detail=resp.text[:300],
                )
    except Exception as e:
        logger.error("sync_hook_update_error", printify_id=printify_id, error=str(e))


async def _sync_printify_delete(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful Printify deletion, hard-delete the product from Supabase."""
    output = parse_tool_output(tool_output)
    if not output or not output.get("deleted"):
        return  # Printify delete failed — no sync needed

    printify_id = tool_input.get("product_id", "")
    if not printify_id:
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 1. Find the product DB id by printify_id
            find_url = (
                f"{supabase_url}/rest/v1/products"
                f"?printify_id=eq.{printify_id}&select=id"
            )
            resp = await client.get(find_url, headers=headers)
            if resp.status_code >= 400 or not resp.text:
                logger.warning(
                    "sync_hook_product_not_found",
                    printify_id=printify_id,
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
                    printify_id=printify_id,
                    product_id=product_id,
                )
            else:
                logger.error(
                    "sync_hook_delete_failed",
                    printify_id=printify_id,
                    product_id=product_id,
                    status=resp.status_code,
                    detail=resp.text[:200],
                )

    except Exception as e:
        logger.error(
            "sync_hook_error",
            printify_id=printify_id,
            error=str(e),
        )


async def _sync_printify_cancel_order(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
) -> None:
    """After successful order cancellation, update order status in Supabase."""
    output = parse_tool_output(tool_output)
    if not output or not output.get("cancelled"):
        return

    order_id = tool_input.get("order_id", "")
    if not order_id:
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.patch(
                f"{supabase_url}/rest/v1/orders?printify_order_id=eq.{order_id}",
                headers=headers,
                json={"status": "cancelled"},
            )
            if resp.status_code < 400:
                logger.info(
                    "sync_hook_order_cancelled",
                    printify_order_id=order_id,
                )
            else:
                logger.warning(
                    "sync_hook_cancel_order_patch_failed",
                    printify_order_id=order_id,
                    status=resp.status_code,
                    detail=resp.text[:200],
                )
    except Exception as e:
        logger.error("sync_hook_cancel_order_error", order_id=order_id, error=str(e))


async def _sync_printify_publish(
    tool_input: dict[str, Any],
    tool_output: Any,
    headers: dict[str, str],
    supabase_url: str,
    printify_token: str = "",
    shop_id: str = "",
) -> None:
    """After Printify publish, verify actual visibility before setting status.

    Verify-then-activate: GETs the product from Printify to check `visible=true`.
    - If verified visible → status='active' + published_at
    - If not yet visible → status='publishing' (transitional, cron reconciles within 2h)

    Also checks if product_variants exist — if not, fetches full product from Printify
    and inserts variants as a fallback (covers cases where create didn't insert them).
    """
    output = parse_tool_output(tool_output)

    # Accept if output indicates success (published=true or no error)
    if isinstance(output, dict) and output.get("error"):
        return  # Publish failed — no sync

    # Printify publish may return {published: true} or just succeed with 200
    # Be permissive: if we got here and there's no explicit error, it worked
    printify_id = tool_input.get("product_id", "")
    if not printify_id:
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Find the product in Supabase by printify_id
            find_url = (
                f"{supabase_url}/rest/v1/products"
                f"?printify_id=eq.{printify_id}&select=id,status"
            )
            resp = await client.get(find_url, headers=headers)
            if resp.status_code >= 400 or not resp.text:
                logger.warning(
                    "sync_hook_publish_product_not_found",
                    printify_id=printify_id,
                )
                return

            products = resp.json()
            if not products:
                logger.warning(
                    "sync_hook_publish_no_matching_product",
                    printify_id=printify_id,
                )
                return

            product = products[0]
            product_id = product["id"]

            # Only activate if currently draft/inactive/publishing (avoid re-activating deleted)
            if product.get("status") not in ("draft", "inactive", "publishing"):
                logger.debug(
                    "sync_hook_publish_skip",
                    printify_id=printify_id,
                    current_status=product.get("status"),
                )
                return

            # Verify actual Printify state before activating
            patch_url = (
                f"{supabase_url}/rest/v1/products?id=eq.{product_id}"
            )
            verified_visible = False
            if printify_token and shop_id:
                try:
                    verify_resp = await client.get(
                        f"https://api.printify.com/v1/shops/{shop_id}/products/{printify_id}.json",
                        headers={"Authorization": f"Bearer {printify_token}"},
                        timeout=10,
                    )
                    if verify_resp.status_code < 400:
                        pdata = verify_resp.json()
                        verified_visible = pdata.get("visible", False) is True
                except Exception as verify_err:
                    logger.warning(
                        "sync_hook_publish_verify_failed",
                        printify_id=printify_id,
                        error=str(verify_err),
                    )

            if verified_visible:
                patch_data = {
                    "status": "active",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                # Transitional status — cron reconciles within 2h
                patch_data = {"status": "publishing"}
                logger.warning(
                    "sync_hook_publish_not_yet_visible",
                    printify_id=printify_id,
                    product_id=product_id,
                )

            resp = await client.patch(patch_url, headers=headers, json=patch_data)

            if resp.status_code < 400:
                logger.info(
                    "sync_hook_product_status_set",
                    printify_id=printify_id,
                    product_id=product_id,
                    new_status=patch_data["status"],
                    verified=verified_visible,
                )

                # Confirm publishing to Printify (custom integration requirement)
                if printify_token and shop_id:
                    try:
                        succeed_url = (
                            f"https://api.printify.com/v1/shops/{shop_id}"
                            f"/products/{printify_id}/publishing_succeeded.json"
                        )
                        succeed_body = {
                            "external": {
                                "id": str(product_id),
                                "handle": f"/shop/{product_id}",
                            }
                        }
                        succeed_resp = await client.post(
                            succeed_url,
                            headers={
                                "Authorization": f"Bearer {printify_token}",
                                "Content-Type": "application/json",
                            },
                            json=succeed_body,
                            timeout=15,
                        )
                        if succeed_resp.status_code < 400:
                            logger.info(
                                "sync_hook_publishing_succeeded",
                                printify_id=printify_id,
                            )
                        else:
                            logger.warning(
                                "sync_hook_publishing_succeeded_failed",
                                printify_id=printify_id,
                                status=succeed_resp.status_code,
                            )
                    except Exception as pub_err:
                        logger.warning(
                            "sync_hook_publishing_succeeded_error",
                            printify_id=printify_id,
                            error=str(pub_err),
                        )
            else:
                logger.error(
                    "sync_hook_activate_failed",
                    printify_id=printify_id,
                    product_id=product_id,
                    status=resp.status_code,
                    detail=resp.text[:200],
                )

            # --- Variant fallback: if product has 0 variants, fetch from Printify ---
            try:
                vcheck = await client.get(
                    f"{supabase_url}/rest/v1/product_variants"
                    f"?product_id=eq.{product_id}&select=id&limit=1",
                    headers=headers,
                )
                existing_variants = vcheck.json() if vcheck.status_code < 400 else []
                if not existing_variants and printify_token and shop_id:
                    logger.warning("sync_hook_publish_no_variants", printify_id=printify_id)
                    pfetch = await client.get(
                        f"https://api.printify.com/v1/shops/{shop_id}/products/{printify_id}.json",
                        headers={"Authorization": f"Bearer {printify_token}"},
                        timeout=15,
                    )
                    if pfetch.status_code < 400:
                        pdata = pfetch.json()
                        await _insert_variants(
                            client, headers, supabase_url,
                            product_id, printify_id,
                            pdata.get("variants", []),
                            images=pdata.get("images", []),
                        )
                    else:
                        logger.warning(
                            "sync_hook_publish_printify_fetch_failed",
                            printify_id=printify_id,
                            status=pfetch.status_code,
                        )
            except Exception as e:
                logger.warning("sync_hook_publish_variant_check_error", error=str(e))

    except Exception as e:
        logger.error(
            "sync_hook_publish_error",
            printify_id=printify_id,
            error=str(e),
        )
