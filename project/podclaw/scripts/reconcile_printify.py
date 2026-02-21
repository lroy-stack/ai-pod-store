"""
PodClaw — Printify ↔ Supabase Reconciliation Script
======================================================

Standalone (no LLM) script that finds and fixes data drift between
Printify and Supabase:

1. Orphans: products in Printify missing from Supabase → insert skeleton row
2. Ghosts:  products in Supabase whose printify_id no longer exists in Printify → mark deleted

Run:
    cd pod_workspace/project
    source ../../venv/bin/activate
    python3 -m podclaw.scripts.reconcile_printify
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import sys
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

_root = Path(__file__).resolve().parent.parent.parent.parent  # pod_workspace/..
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv

load_dotenv(_root / "config" / ".env.required")
load_dotenv(_root / "pod_workspace" / "project" / "frontend" / ".env.local", override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
PRINTIFY_TOKEN = os.environ["PRINTIFY_API_TOKEN"]
PRINTIFY_SHOP = os.environ["PRINTIFY_SHOP_ID"]

PRINTIFY_API = "https://api.printify.com/v1"
_USD_TO_EUR = 0.92


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _engagement_price(cost_cents: int) -> int:
    markup = max(cost_cents * 1.4, cost_cents + 200)
    rounded = math.ceil(markup / 100) * 100 - 1
    return max(rounded, cost_cents + 100)


async def _fetch_all_printify(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all products from Printify (paginated)."""
    headers = {
        "Authorization": f"Bearer {PRINTIFY_TOKEN}",
        "Content-Type": "application/json",
    }
    products = []
    page = 1
    while True:
        url = f"{PRINTIFY_API}/shops/{PRINTIFY_SHOP}/products.json?page={page}&limit=50"
        resp = await client.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data", [])
        products.extend(items)
        if page >= data.get("last_page", 1):
            break
        page += 1
    return products


async def _fetch_all_supabase(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all products from Supabase that have a printify_id."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{SUPABASE_URL}/rest/v1/products?printify_id=not.is.null&select=id,printify_id,title,status&limit=1000"
    resp = await client.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


async def _upsert_skeleton(client: httpx.AsyncClient, product: dict) -> bool:
    """Insert a skeleton row from a Printify product dict. Returns True on success."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    printify_id = str(product["id"])
    title = product.get("title", "Untitled")
    description = product.get("description", "")

    variants = product.get("variants", [])
    costs_usd = [v.get("cost", 0) for v in variants if v.get("cost")]
    min_cost_usd = min(costs_usd) if costs_usd else 0
    cost_eur = int(min_cost_usd * _USD_TO_EUR) if min_cost_usd else 0

    prices = [v.get("price", 0) for v in variants if v.get("price")]
    min_price = min(prices) if prices else 0
    base_price = min_price if min_price > 0 else _engagement_price(cost_eur) if cost_eur > 0 else 2999

    raw_images = product.get("images", [])
    images = [{"src": img.get("src", ""), "alt": title} for img in raw_images if img.get("src")]

    row = {
        "printify_id": printify_id,
        "title": title,
        "description": description[:2000] if description else "",
        "status": "draft",
        "currency": "EUR",
        "cost_cents": cost_eur,
        "base_price_cents": base_price,
        "images": json.dumps(images),
        "category": "uncategorized",
    }

    resp = await client.post(
        f"{SUPABASE_URL}/rest/v1/products",
        headers=headers,
        json=row,
        timeout=15,
    )
    return resp.status_code < 400


async def _mark_deleted(client: httpx.AsyncClient, product_id: str) -> bool:
    """Mark a Supabase product as deleted."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
        headers=headers,
        json={"status": "deleted"},
        timeout=15,
    )
    return resp.status_code < 400


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def reconcile() -> dict:
    """Run full reconciliation. Returns summary dict."""
    async with httpx.AsyncClient() as client:
        print("Fetching Printify products...")
        printify_products = await _fetch_all_printify(client)
        print(f"  Found {len(printify_products)} products in Printify")

        print("Fetching Supabase products...")
        supabase_products = await _fetch_all_supabase(client)
        print(f"  Found {len(supabase_products)} products in Supabase (with printify_id)")

        # Build lookup sets
        printify_ids = {str(p["id"]) for p in printify_products}
        supabase_by_pid = {p["printify_id"]: p for p in supabase_products}
        supabase_pids = set(supabase_by_pid.keys())

        # Orphans: in Printify but not in Supabase
        orphan_ids = printify_ids - supabase_pids
        orphan_products = [p for p in printify_products if str(p["id"]) in orphan_ids]

        # Ghosts: in Supabase but not in Printify (and not already deleted)
        ghost_ids = supabase_pids - printify_ids
        ghost_products = [
            supabase_by_pid[pid] for pid in ghost_ids
            if supabase_by_pid[pid].get("status") != "deleted"
        ]

        print(f"\nOrphans (Printify only): {len(orphan_products)}")
        inserted = 0
        for p in orphan_products:
            title = p.get("title", "?")[:50]
            ok = await _upsert_skeleton(client, p)
            status = "OK" if ok else "FAIL"
            print(f"  [{status}] {p['id']} — {title}")
            inserted += ok

        print(f"\nGhosts (Supabase only, not in Printify): {len(ghost_products)}")
        marked = 0
        for p in ghost_products:
            title = p.get("title", "?")[:50]
            ok = await _mark_deleted(client, p["id"])
            status = "OK" if ok else "FAIL"
            print(f"  [{status}] {p['printify_id']} — {title}")
            marked += ok

        summary = {
            "printify_total": len(printify_products),
            "supabase_total": len(supabase_products),
            "orphans_found": len(orphan_products),
            "orphans_inserted": inserted,
            "ghosts_found": len(ghost_products),
            "ghosts_marked_deleted": marked,
        }

        print(f"\n{'='*50}")
        print(f"RECONCILIATION SUMMARY")
        print(f"  Printify total:    {summary['printify_total']}")
        print(f"  Supabase total:    {summary['supabase_total']}")
        print(f"  Orphans inserted:  {summary['orphans_inserted']}/{summary['orphans_found']}")
        print(f"  Ghosts deleted:    {summary['ghosts_marked_deleted']}/{summary['ghosts_found']}")
        print(f"{'='*50}")

        return summary


if __name__ == "__main__":
    asyncio.run(reconcile())
