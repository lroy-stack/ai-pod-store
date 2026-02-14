#!/usr/bin/env python3
"""Pricing Analytics.

Analyzes product price distribution, top/bottom performers by revenue,
and price-vs-volume correlation.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_products, get_orders


def run() -> dict:
    """Run pricing analytics.

    Returns:
        Dict with price_stats, top_revenue_products, and price_ranges.
    """
    products = get_products()
    orders = get_orders(days=90)

    if not products:
        return {
            "price_stats": {"min": 0, "max": 0, "median": 0, "mean": 0},
            "top_revenue_products": [],
            "price_ranges": [],
        }

    # Build product lookup
    product_map: dict[str, dict] = {}
    for p in products:
        pid = p.get("id", "")
        product_map[pid] = {
            "id": pid,
            "name": p.get("name", p.get("title", "Unknown")),
            "price": float(p.get("price", 0) or 0),
        }

    prices = np.array([p["price"] for p in product_map.values() if p["price"] > 0])

    price_stats = {
        "min": round(float(np.min(prices)), 2) if len(prices) > 0 else 0,
        "max": round(float(np.max(prices)), 2) if len(prices) > 0 else 0,
        "median": round(float(np.median(prices)), 2) if len(prices) > 0 else 0,
        "mean": round(float(np.mean(prices)), 2) if len(prices) > 0 else 0,
    }

    # Calculate revenue per product from order_items
    revenue_by_product: dict[str, float] = {}
    volume_by_product: dict[str, int] = {}
    for order in orders:
        items = order.get("order_items", []) or []
        for item in items:
            pid = item.get("product_id", "")
            qty = int(item.get("quantity", 1) or 1)
            item_price = float(item.get("price", 0) or item.get("unit_price", 0) or 0)
            revenue_by_product[pid] = revenue_by_product.get(pid, 0) + (item_price * qty)
            volume_by_product[pid] = volume_by_product.get(pid, 0) + qty

    # Top revenue products
    revenue_list = []
    for pid, rev in revenue_by_product.items():
        info = product_map.get(pid, {"id": pid, "name": "Unknown", "price": 0})
        revenue_list.append({
            "id": pid,
            "name": info["name"],
            "price": info["price"],
            "revenue": round(rev, 2),
            "units_sold": volume_by_product.get(pid, 0),
        })
    revenue_list.sort(key=lambda x: x["revenue"], reverse=True)
    top_revenue = revenue_list[:10]

    # Price ranges
    range_bins = [(0, 25), (25, 50), (50, 100), (100, 200), (200, float("inf"))]
    range_labels = ["0-25", "25-50", "50-100", "100-200", "200+"]
    price_ranges = []
    for (lo, hi), label in zip(range_bins, range_labels):
        products_in_range = [
            pid for pid, info in product_map.items()
            if lo <= info["price"] < hi
        ]
        range_revenue = sum(revenue_by_product.get(pid, 0) for pid in products_in_range)
        count = len(products_in_range)
        avg_rev = round(range_revenue / count, 2) if count > 0 else 0
        price_ranges.append({
            "range": label,
            "count": count,
            "avg_revenue": avg_rev,
        })

    return {
        "price_stats": price_stats,
        "top_revenue_products": top_revenue,
        "price_ranges": price_ranges,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
