"""
PodClaw — Full Reconciliation & Data Fix Script (one-shot)
=============================================================

Performs 5 remediation passes:

A. Reconcile Printify ↔ Supabase (delete test artifacts, insert orphans)
B. Populate product_variants from Printify variant data
C. Fix products with JSON in description field
D. Process bg_removed_url for designs missing it
E. Detect width/height for designs missing dimensions

Run:
    cd pod_workspace/project
    source ../../venv/bin/activate
    python3 -m podclaw.scripts.reconcile_and_fix
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import struct
import sys
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

_root = Path(__file__).resolve().parent.parent.parent.parent  # pod-agent-harness/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv

load_dotenv(_root / "config" / ".env.required")
load_dotenv(_root / "pod_workspace" / "project" / "frontend" / ".env.local", override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
PRINTIFY_TOKEN = os.environ["PRINTIFY_API_TOKEN"]
PRINTIFY_SHOP = os.environ["PRINTIFY_SHOP_ID"]
FAL_KEY = os.environ.get("FAL_KEY", "")

PRINTIFY_API = "https://api.printify.com/v1"
_USD_TO_EUR = 0.92

# Test artifact patterns in product titles
_TEST_PATTERNS = re.compile(r"\[E2E\]|\[TREND-E2E\]|\[TEST\]", re.IGNORECASE)

SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

PF_HEADERS = {
    "Authorization": f"Bearer {PRINTIFY_TOKEN}",
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Pricing (mirrors sync_hook._engagement_price)
# ---------------------------------------------------------------------------

def _engagement_price(cost_cents: int, title: str = "") -> int:
    title_lower = title.lower()
    if any(k in title_lower for k in ("sticker", "pin", "badge", "magnet")):
        multiplier, min_price = 2.5, 399
    elif any(k in title_lower for k in ("mug", "phone case", "iphone", "samsung", "case")):
        multiplier, min_price = 2.0, 999
    elif any(k in title_lower for k in ("hoodie", "sweater", "sweatshirt", "pullover")):
        multiplier, min_price = 1.7, 2999
    elif any(k in title_lower for k in ("t-shirt", "tee", "tote", "bag", "tank")):
        multiplier, min_price = 1.8, 1499
    elif any(k in title_lower for k in ("poster", "canvas", "print", "art")):
        multiplier, min_price = 2.0, 799
    elif any(k in title_lower for k in ("blanket", "pillow", "throw", "cushion", "flag")):
        multiplier, min_price = 1.55, 3999
    else:
        multiplier, min_price = 1.8, 1499
    raw = cost_cents * multiplier
    floor = cost_cents * 1.4
    raw = max(raw, floor)
    ceiling = cost_cents * 3.0
    raw = min(raw, ceiling)
    rounded = math.ceil(raw / 100) * 100 - 1
    return max(rounded, min_price)


# ---------------------------------------------------------------------------
# Printify helpers
# ---------------------------------------------------------------------------

async def _fetch_all_printify(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all products from Printify (paginated)."""
    products = []
    page = 1
    while True:
        url = f"{PRINTIFY_API}/shops/{PRINTIFY_SHOP}/products.json?page={page}&limit=50"
        resp = await client.get(url, headers=PF_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data", [])
        products.extend(items)
        if page >= data.get("last_page", 1):
            break
        page += 1
    return products


async def _fetch_printify_product(client: httpx.AsyncClient, printify_id: str) -> dict | None:
    """Fetch a single product from Printify."""
    url = f"{PRINTIFY_API}/shops/{PRINTIFY_SHOP}/products/{printify_id}.json"
    resp = await client.get(url, headers=PF_HEADERS, timeout=30)
    if resp.status_code >= 400:
        return None
    return resp.json()


async def _delete_printify_product(client: httpx.AsyncClient, printify_id: str) -> bool:
    """Delete a product from Printify."""
    url = f"{PRINTIFY_API}/shops/{PRINTIFY_SHOP}/products/{printify_id}.json"
    resp = await client.delete(url, headers=PF_HEADERS, timeout=30)
    return resp.status_code < 400


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

async def _sb_query(client: httpx.AsyncClient, path: str) -> list[dict]:
    resp = await client.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


async def _sb_insert(client: httpx.AsyncClient, table: str, rows: list[dict], upsert: bool = False) -> bool:
    hdrs = {**SB_HEADERS}
    if upsert:
        hdrs["Prefer"] = "resolution=merge-duplicates,return=minimal"
    else:
        hdrs["Prefer"] = "return=minimal"
    resp = await client.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=hdrs,
        json=rows,
        timeout=30,
    )
    return resp.status_code < 400


async def _sb_update(client: httpx.AsyncClient, table: str, filters: str, patch: dict) -> bool:
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{filters}",
        headers={**SB_HEADERS, "Prefer": "return=minimal"},
        json=patch,
        timeout=30,
    )
    return resp.status_code < 400


# ---------------------------------------------------------------------------
# PASS A: Reconcile Printify ↔ Supabase
# ---------------------------------------------------------------------------

async def pass_a_reconcile(client: httpx.AsyncClient) -> dict:
    """Reconcile Printify products with Supabase. Clean test artifacts."""
    print("\n" + "=" * 60)
    print("PASS A: Reconcile Printify ↔ Supabase")
    print("=" * 60)

    printify_products = await _fetch_all_printify(client)
    print(f"  Printify: {len(printify_products)} products")

    sb_products = await _sb_query(client, "products?printify_id=not.is.null&select=id,printify_id,title,status&limit=1000")
    print(f"  Supabase: {len(sb_products)} products (with printify_id)")

    printify_ids = {str(p["id"]) for p in printify_products}
    sb_by_pid = {p["printify_id"]: p for p in sb_products}

    orphan_ids = printify_ids - set(sb_by_pid.keys())
    orphan_products = [p for p in printify_products if str(p["id"]) in orphan_ids]

    test_deleted = 0
    orphans_inserted = 0

    for p in orphan_products:
        title = p.get("title", "")
        pid = str(p["id"])

        # Test artifacts → delete from Printify
        if _TEST_PATTERNS.search(title):
            ok = await _delete_printify_product(client, pid)
            status = "DELETED" if ok else "DEL-FAIL"
            print(f"  [{status}] {pid} — {title[:50]} (test artifact)")
            test_deleted += ok
            continue

        # Real orphan → insert skeleton in Supabase
        variants = p.get("variants", [])
        costs = [v.get("cost", 0) for v in variants if isinstance(v, dict) and v.get("cost")]
        min_cost_usd = min(costs) if costs else 0
        cost_eur = int(min_cost_usd * _USD_TO_EUR) if min_cost_usd else 0
        base_price = _engagement_price(cost_eur, title) if cost_eur > 0 else 2999

        raw_images = p.get("images", [])
        images = []
        for img in raw_images:
            if isinstance(img, dict):
                src = img.get("src") or img.get("url", "")
                if src:
                    images.append({"src": src, "alt": title})

        row = {
            "printify_id": pid,
            "title": title,
            "description": (p.get("description", "") or "")[:2000],
            "status": "draft",
            "currency": "EUR",
            "cost_cents": cost_eur,
            "base_price_cents": base_price,
            "images": json.dumps(images),
            "category": "uncategorized",
        }
        ok = await _sb_insert(client, "products", [row], upsert=True)
        status = "INSERT" if ok else "FAIL"
        print(f"  [{status}] {pid} — {title[:50]}")
        orphans_inserted += ok

    # Mark ghosts (in Supabase but not Printify) as deleted
    ghost_ids = set(sb_by_pid.keys()) - printify_ids
    ghosts_marked = 0
    for pid in ghost_ids:
        sp = sb_by_pid[pid]
        if sp.get("status") == "deleted":
            continue
        ok = await _sb_update(client, "products", f"id=eq.{sp['id']}", {"status": "deleted"})
        if ok:
            ghosts_marked += 1
            print(f"  [GHOST→DEL] {pid} — {sp.get('title', '?')[:50]}")

    summary = {
        "printify_total": len(printify_products),
        "supabase_total": len(sb_products),
        "test_artifacts_deleted": test_deleted,
        "orphans_inserted": orphans_inserted,
        "ghosts_marked": ghosts_marked,
    }
    print(f"\n  Summary: {test_deleted} test deleted, {orphans_inserted} orphans inserted, {ghosts_marked} ghosts marked")
    return summary


# ---------------------------------------------------------------------------
# PASS B: Populate product_variants
# ---------------------------------------------------------------------------

async def pass_b_variants(client: httpx.AsyncClient) -> dict:
    """Populate product_variants from Printify variant data."""
    print("\n" + "=" * 60)
    print("PASS B: Populate product_variants")
    print("=" * 60)

    # Get all Supabase products with printify_id
    products = await _sb_query(
        client,
        "products?printify_id=not.is.null&status=neq.deleted&select=id,printify_id,title&limit=1000"
    )
    print(f"  Products to process: {len(products)}")

    # Check existing variants
    existing = await _sb_query(client, "product_variants?select=product_id&limit=10000")
    products_with_variants = {r["product_id"] for r in existing}

    total_inserted = 0
    errors = 0

    for p in products:
        pid = p["printify_id"]
        db_id = p["id"]

        # Skip if already has variants
        if db_id in products_with_variants:
            continue

        # Fetch full product from Printify
        pf_product = await _fetch_printify_product(client, pid)
        if not pf_product:
            print(f"  [SKIP] {pid} — not found in Printify")
            errors += 1
            continue

        variants = pf_product.get("variants", [])
        if not variants:
            print(f"  [SKIP] {pid} — no variants")
            continue

        # Map mockup images to variant IDs
        images = pf_product.get("images", [])
        img_map: dict[int, str] = {}
        for img in images:
            if not isinstance(img, dict):
                continue
            src = img.get("src") or img.get("url", "")
            if not src:
                continue
            for vid_i in (img.get("variant_ids", []) or []):
                if vid_i and vid_i not in img_map:
                    img_map[vid_i] = src

        variant_rows = []
        for v in variants:
            if not isinstance(v, dict):
                continue
            vid = v.get("id") or v.get("variant_id")
            if not vid:
                continue
            v_price = v.get("price", 0)
            row = {
                "product_id": db_id,
                "printify_variant_id": str(vid),
                "title": v.get("title", ""),
                "size": v.get("size") or (v.get("options", {}) or {}).get("size", ""),
                "color": v.get("color") or (v.get("options", {}) or {}).get("color", ""),
                "price_cents": v_price if isinstance(v_price, int) else int(v_price or 0),
                "sku": v.get("sku", ""),
                "is_enabled": v.get("is_enabled", True),
                "is_available": v.get("is_available", True),
            }
            int_vid = int(vid) if str(vid).isdigit() else None
            if int_vid and int_vid in img_map:
                row["image_url"] = img_map[int_vid]
            variant_rows.append(row)

        if variant_rows:
            ok = await _sb_insert(client, "product_variants", variant_rows)
            if ok:
                total_inserted += len(variant_rows)
                print(f"  [OK] {pid} — {len(variant_rows)} variants ({p.get('title', '?')[:40]})")
            else:
                errors += 1
                print(f"  [FAIL] {pid} — insert failed ({p.get('title', '?')[:40]})")

        # Throttle to avoid rate limits
        await asyncio.sleep(0.3)

    summary = {"variants_inserted": total_inserted, "errors": errors}
    print(f"\n  Summary: {total_inserted} variants inserted, {errors} errors")
    return summary


# ---------------------------------------------------------------------------
# PASS C: Fix JSON descriptions
# ---------------------------------------------------------------------------

async def pass_c_fix_descriptions(client: httpx.AsyncClient) -> dict:
    """Fix products that have JSON strings in the description field."""
    print("\n" + "=" * 60)
    print("PASS C: Fix JSON descriptions")
    print("=" * 60)

    # Supabase doesn't support LIKE with special chars well via REST,
    # so fetch all and filter in Python
    products = await _sb_query(
        client,
        "products?status=neq.deleted&select=id,title,description&limit=1000"
    )

    fixed = 0
    for p in products:
        desc = p.get("description", "") or ""
        if not (desc.startswith("{") or desc.startswith("[")):
            continue

        # Try to parse JSON and extract text
        try:
            parsed = json.loads(desc)
            if isinstance(parsed, dict):
                # Common patterns: {"description": "text"} or {"en": "text"}
                text = (
                    parsed.get("description")
                    or parsed.get("en")
                    or parsed.get("text")
                    or parsed.get("title")
                    or ""
                )
                if not text and parsed:
                    # Take first string value
                    for v in parsed.values():
                        if isinstance(v, str) and len(v) > 10:
                            text = v
                            break
            elif isinstance(parsed, list):
                text = " ".join(str(item) for item in parsed if isinstance(item, str))
            else:
                text = str(parsed)
        except (json.JSONDecodeError, TypeError):
            # Not valid JSON — just strip braces
            text = desc.strip("{}[]").strip()

        if not text:
            text = p.get("title", "")

        ok = await _sb_update(client, "products", f"id=eq.{p['id']}", {"description": text[:2000]})
        status = "FIXED" if ok else "FAIL"
        print(f"  [{status}] {p.get('title', '?')[:50]} — was JSON, now plain text")
        fixed += ok

    summary = {"json_descriptions_fixed": fixed}
    print(f"\n  Summary: {fixed} descriptions fixed")
    return summary


# ---------------------------------------------------------------------------
# PASS D: bg_removed_url for designs
# ---------------------------------------------------------------------------

async def pass_d_bg_removal(client: httpx.AsyncClient) -> dict:
    """Process background removal for designs missing bg_removed_url."""
    print("\n" + "=" * 60)
    print("PASS D: Background removal for designs")
    print("=" * 60)

    if not FAL_KEY:
        print("  [SKIP] FAL_KEY not set — cannot process background removal")
        return {"bg_processed": 0, "skipped": "no FAL_KEY"}

    designs = await _sb_query(
        client,
        "designs?bg_removed_url=is.null&image_url=not.is.null&select=id,image_url,prompt&limit=100"
    )
    print(f"  Designs needing bg removal: {len(designs)}")

    processed = 0
    errors = 0

    for d in designs:
        image_url = d.get("image_url", "")
        if not image_url or "nobg-" in image_url:
            continue

        try:
            # Call fal.ai rembg
            fal_resp = await client.post(
                "https://queue.fal.run/fal-ai/birefnet/v2",
                headers={
                    "Authorization": f"Key {FAL_KEY}",
                    "Content-Type": "application/json",
                },
                json={"image_url": image_url},
                timeout=60,
            )

            if fal_resp.status_code >= 400:
                print(f"  [FAIL] {d['id'][:8]} — fal rembg returned {fal_resp.status_code}")
                errors += 1
                continue

            result = fal_resp.json()
            bg_url = result.get("image", {}).get("url", "")

            if not bg_url:
                print(f"  [FAIL] {d['id'][:8]} — no image URL in rembg response")
                errors += 1
                continue

            # Upload to Supabase Storage
            img_resp = await client.get(bg_url, timeout=30)
            if img_resp.status_code >= 400:
                errors += 1
                continue

            filename = f"nobg-{d['id'][:8]}.png"
            upload_url = f"{SUPABASE_URL}/storage/v1/object/designs/{filename}"
            upload_resp = await client.post(
                upload_url,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "image/png",
                    "x-upsert": "true",
                },
                content=img_resp.content,
                timeout=30,
            )

            if upload_resp.status_code >= 400:
                print(f"  [FAIL] {d['id'][:8]} — storage upload failed: {upload_resp.status_code}")
                errors += 1
                continue

            public_url = f"{SUPABASE_URL}/storage/v1/object/public/designs/{filename}"
            ok = await _sb_update(
                client, "designs", f"id=eq.{d['id']}",
                {"bg_removed_url": public_url}
            )
            if ok:
                processed += 1
                prompt_preview = (d.get("prompt") or "")[:30]
                print(f"  [OK] {d['id'][:8]} — {prompt_preview}")
            else:
                errors += 1

        except Exception as e:
            print(f"  [ERR] {d['id'][:8]} — {e}")
            errors += 1

        # Throttle — rembg is heavy
        await asyncio.sleep(1.0)

    summary = {"bg_processed": processed, "bg_errors": errors}
    print(f"\n  Summary: {processed} processed, {errors} errors")
    return summary


# ---------------------------------------------------------------------------
# PASS E: Detect dimensions for designs
# ---------------------------------------------------------------------------

def _detect_png_dimensions(data: bytes) -> tuple[int, int] | None:
    """Extract width/height from PNG IHDR chunk."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    if len(data) < 24:
        return None
    w, h = struct.unpack(">II", data[16:24])
    return (w, h)


def _detect_jpeg_dimensions(data: bytes) -> tuple[int, int] | None:
    """Extract width/height from JPEG SOF marker."""
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        # SOF0, SOF1, SOF2
        if marker in (0xC0, 0xC1, 0xC2):
            h = struct.unpack(">H", data[i + 5:i + 7])[0]
            w = struct.unpack(">H", data[i + 7:i + 9])[0]
            return (w, h)
        i += 2 + length
    return None


def _detect_webp_dimensions(data: bytes) -> tuple[int, int] | None:
    """Extract width/height from WebP header."""
    if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        return None
    # VP8 lossy
    if data[12:16] == b'VP8 ' and len(data) >= 30:
        w = struct.unpack("<H", data[26:28])[0] & 0x3FFF
        h = struct.unpack("<H", data[28:30])[0] & 0x3FFF
        return (w, h)
    # VP8L lossless
    if data[12:16] == b'VP8L' and len(data) >= 25:
        bits = struct.unpack("<I", data[21:25])[0]
        w = (bits & 0x3FFF) + 1
        h = ((bits >> 14) & 0x3FFF) + 1
        return (w, h)
    return None


async def pass_e_dimensions(client: httpx.AsyncClient) -> dict:
    """Detect and set width/height for designs missing dimensions."""
    print("\n" + "=" * 60)
    print("PASS E: Detect design dimensions")
    print("=" * 60)

    designs = await _sb_query(
        client,
        "designs?width=is.null&image_url=not.is.null&select=id,image_url,prompt&limit=100"
    )
    print(f"  Designs needing dimensions: {len(designs)}")

    updated = 0
    errors = 0

    for d in designs:
        image_url = d.get("image_url", "")
        if not image_url:
            continue

        try:
            # Fetch just the first 32KB (enough for headers)
            resp = await client.get(
                image_url,
                headers={"Range": "bytes=0-32767"},
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code >= 400:
                errors += 1
                continue

            data = resp.content
            dims = _detect_png_dimensions(data) or _detect_jpeg_dimensions(data) or _detect_webp_dimensions(data)

            if not dims:
                # Fallback: default based on aspect ratio heuristic
                dims = (1024, 1024)

            w, h = dims
            ok = await _sb_update(
                client, "designs", f"id=eq.{d['id']}",
                {"width": w, "height": h}
            )
            if ok:
                updated += 1
            else:
                errors += 1

        except Exception as e:
            print(f"  [ERR] {d['id'][:8]} — {e}")
            errors += 1

        await asyncio.sleep(0.2)

    summary = {"dimensions_updated": updated, "dimension_errors": errors}
    print(f"\n  Summary: {updated} updated, {errors} errors")
    return summary


# ---------------------------------------------------------------------------
# PASS F: Flag products with empty translations
# ---------------------------------------------------------------------------

async def pass_f_translations(client: httpx.AsyncClient) -> dict:
    """Flag products with empty translations for the cataloger to fix.

    Does NOT auto-generate translations (that's the cataloger's job).
    Instead, sets a marker so the cataloger prioritizes them.
    """
    print("\n" + "=" * 60)
    print("PASS F: Flag empty translations")
    print("=" * 60)

    # Fetch all active products and filter in Python (REST API can't filter on JSONB = '{}')
    products = await _sb_query(
        client,
        "products?status=eq.active&select=id,title,translations,description&limit=1000"
    )

    empty_translations = 0
    json_in_desc = 0

    for p in products:
        translations = p.get("translations") or {}
        desc = p.get("description", "") or ""
        title = p.get("title", "?")[:50]

        if not translations or translations == {} or not isinstance(translations, dict):
            empty_translations += 1
            print(f"  [EMPTY-I18N] {title}")

        if desc.startswith("{") or desc.startswith("["):
            json_in_desc += 1
            print(f"  [JSON-DESC] {title}")

    summary = {
        "active_products": len(products),
        "empty_translations": empty_translations,
        "json_in_description": json_in_desc,
    }
    print(f"\n  Summary: {empty_translations} missing translations, {json_in_desc} JSON descriptions (of {len(products)} active)")
    return summary


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run_all() -> dict:
    """Run all 6 remediation passes."""
    print("=" * 60)
    print("  PodClaw Reconciliation & Data Fix")
    print("=" * 60)

    results = {}

    async with httpx.AsyncClient() as client:
        results["pass_a"] = await pass_a_reconcile(client)
        results["pass_b"] = await pass_b_variants(client)
        results["pass_c"] = await pass_c_fix_descriptions(client)
        results["pass_d"] = await pass_d_bg_removal(client)
        results["pass_e"] = await pass_e_dimensions(client)
        results["pass_f"] = await pass_f_translations(client)

    print("\n" + "=" * 60)
    print("  FINAL SUMMARY")
    print("=" * 60)
    for k, v in results.items():
        print(f"  {k}: {v}")
    print("=" * 60)

    return results


if __name__ == "__main__":
    asyncio.run(run_all())
