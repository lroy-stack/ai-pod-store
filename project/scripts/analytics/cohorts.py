#!/usr/bin/env python3
"""Cohort Retention Analysis.

Groups users by their signup month and tracks in which subsequent
months they placed orders, building a retention matrix.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_orders, get_customers


def run() -> dict:
    """Run cohort retention analysis.

    Returns:
        Dict with cohorts list and avg_retention percentages.
    """
    customers = get_customers()
    orders = get_orders(days=365)

    if not customers:
        return {"cohorts": [], "avg_retention": {}}

    # Map customer_id -> signup month (YYYY-MM)
    signup_month: dict[str, str] = {}
    for c in customers:
        cid = c.get("id", "")
        created = c.get("created_at", "")
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            signup_month[cid] = dt.strftime("%Y-%m")
        except (ValueError, AttributeError):
            continue

    if not signup_month:
        return {"cohorts": [], "avg_retention": {}}

    # Map customer_id -> set of months with orders
    order_months: dict[str, set[str]] = defaultdict(set)
    for order in orders:
        cid = order.get("user_id") or order.get("customer_id", "")
        if not cid or cid not in signup_month:
            continue
        created = order.get("created_at", "")
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            order_months[cid].add(dt.strftime("%Y-%m"))
        except (ValueError, AttributeError):
            continue

    # Build cohorts
    cohort_customers: dict[str, list[str]] = defaultdict(list)
    for cid, month in signup_month.items():
        cohort_customers[month].append(cid)

    # Helper: months between two YYYY-MM strings
    def month_diff(start: str, end: str) -> int:
        sy, sm = map(int, start.split("-"))
        ey, em = map(int, end.split("-"))
        return (ey - sy) * 12 + (em - sm)

    now_month = datetime.now(timezone.utc).strftime("%Y-%m")
    cohorts = []
    all_retention: dict[int, list[float]] = defaultdict(list)

    for cohort_month in sorted(cohort_customers.keys()):
        members = cohort_customers[cohort_month]
        size = len(members)
        if size == 0:
            continue

        max_months = month_diff(cohort_month, now_month)
        retention: dict[str, float] = {}

        for m in range(0, min(max_months + 1, 13)):  # Up to 12 months
            # Count members who had at least one order in cohort_month + m
            sy, sm = map(int, cohort_month.split("-"))
            target_month_num = sm + m
            target_year = sy + (target_month_num - 1) // 12
            target_month = ((target_month_num - 1) % 12) + 1
            target_str = f"{target_year:04d}-{target_month:02d}"

            active = sum(1 for cid in members if target_str in order_months.get(cid, set()))
            pct = round(100 * active / size, 1)
            key = f"month_{m}"
            retention[key] = pct
            all_retention[m].append(pct)

        cohorts.append({
            "cohort": cohort_month,
            "size": size,
            "retention": retention,
        })

    # Average retention across cohorts
    avg_retention = {}
    for m, values in sorted(all_retention.items()):
        if m == 0:
            continue  # Skip month_0 (always signup month)
        avg_retention[f"month_{m}"] = round(sum(values) / len(values), 1) if values else 0

    return {
        "cohorts": cohorts,
        "avg_retention": avg_retention,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
