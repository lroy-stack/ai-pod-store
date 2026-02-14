#!/usr/bin/env python3
"""Trend Analysis.

Identifies trending products based on recent order velocity,
comparing 7-day and 30-day order volumes.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import defaultdict

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_orders


def run() -> dict:
    """Run trend analysis.

    Returns:
        Dict with trending_products list and analysis period.
    """
    orders = get_orders(days=30)

    if not orders:
        return {"trending_products": [], "period": "30d"}

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    # Count per-product orders in 7d and 30d windows
    orders_7d: dict[str, int] = defaultdict(int)
    orders_30d: dict[str, int] = defaultdict(int)
    product_info: dict[str, dict] = {}

    for order in orders:
        created_at = order.get("created_at", "")
        try:
            order_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue

        items = order.get("order_items", []) or []
        for item in items:
            pid = item.get("product_id", "")
            if not pid:
                continue
            qty = int(item.get("quantity", 1) or 1)
            orders_30d[pid] += qty
            if order_date >= seven_days_ago:
                orders_7d[pid] += qty
            if pid not in product_info:
                product_info[pid] = {
                    "id": pid,
                    "name": (
                        item.get("product_name")
                        or item.get("name")
                        or item.get("title")
                        or pid
                    ),
                }

    # Calculate trend score
    # Score = (7d_orders / 7) / (30d_orders / 30) -- velocity ratio
    # A score > 1 means accelerating, < 1 means decelerating
    trending = []
    for pid, count_30d in orders_30d.items():
        count_7d = orders_7d.get(pid, 0)
        daily_7d = count_7d / 7.0
        daily_30d = count_30d / 30.0
        if daily_30d > 0:
            trend_score = round(daily_7d / daily_30d, 2)
        else:
            trend_score = 0.0

        info = product_info.get(pid, {"id": pid, "name": "Unknown"})
        trending.append({
            "id": info["id"],
            "name": info["name"],
            "orders_7d": count_7d,
            "orders_30d": count_30d,
            "trend_score": trend_score,
        })

    # Sort by trend score descending, then by 7d orders
    trending.sort(key=lambda x: (x["trend_score"], x["orders_7d"]), reverse=True)

    return {
        "trending_products": trending[:20],
        "period": "30d",
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
