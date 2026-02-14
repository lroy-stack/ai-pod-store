#!/usr/bin/env python3
"""RFM Customer Segmentation.

Calculates Recency, Frequency, Monetary scores for each customer
and assigns them to actionable segments.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_orders


def _score_quantile(series: pd.Series, ascending: bool = True) -> pd.Series:
    """Score a series 1-5 using quantile bins.

    Args:
        series: Numeric series to score.
        ascending: If True, lower values get higher scores (good for recency).

    Returns:
        Series of integer scores 1-5.
    """
    try:
        labels = [5, 4, 3, 2, 1] if ascending else [1, 2, 3, 4, 5]
        return pd.qcut(series, q=5, labels=labels, duplicates="drop").astype(int)
    except ValueError:
        # Not enough unique values for 5 bins — fall back to rank-based scoring
        rank = series.rank(method="first", ascending=ascending)
        return pd.cut(rank, bins=5, labels=[1, 2, 3, 4, 5], duplicates="drop").astype(int)


def _assign_segment(row: pd.Series) -> str:
    """Assign a customer segment based on RFM scores."""
    r, f = row["R_score"], row["F_score"]
    if r >= 4 and f >= 4:
        return "Champions"
    if f >= 3:
        if r <= 2:
            return "At Risk"
        return "Loyal"
    if r >= 4 and f <= 2:
        return "Potential"
    if r <= 2 and f <= 2:
        if r == 1 and f == 1:
            return "Lost"
        return "Hibernating"
    return "Other"


def run() -> dict:
    """Run RFM analysis.

    Returns:
        Dict with segments list and total_customers count.
    """
    orders = get_orders(days=365)
    if not orders:
        return {"segments": [], "total_customers": 0}

    now = datetime.now(timezone.utc)

    # Build per-customer metrics
    records = []
    for order in orders:
        customer_id = order.get("user_id") or order.get("customer_id")
        if not customer_id:
            continue
        created_at = order.get("created_at", "")
        try:
            order_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        total = float(order.get("total", 0) or 0)
        records.append(
            {"customer_id": customer_id, "order_date": order_date, "total": total}
        )

    if not records:
        return {"segments": [], "total_customers": 0}

    df = pd.DataFrame(records)
    rfm = df.groupby("customer_id").agg(
        recency=("order_date", lambda x: (now - x.max()).days),
        frequency=("order_date", "count"),
        monetary=("total", "sum"),
    ).reset_index()

    # Score 1-5
    rfm["R_score"] = _score_quantile(rfm["recency"], ascending=True)   # lower recency = higher score
    rfm["F_score"] = _score_quantile(rfm["frequency"], ascending=False)  # higher frequency = higher score
    rfm["M_score"] = _score_quantile(rfm["monetary"], ascending=False)   # higher monetary = higher score

    # Assign segments
    rfm["segment"] = rfm.apply(_assign_segment, axis=1)

    # Build response
    segments = []
    for seg_name, group in rfm.groupby("segment"):
        segments.append({
            "name": seg_name,
            "count": int(len(group)),
            "avg_monetary": round(float(group["monetary"].mean()), 2),
            "customers": group["customer_id"].tolist(),
        })

    # Sort by count descending
    segments.sort(key=lambda s: s["count"], reverse=True)

    return {
        "segments": segments,
        "total_customers": int(len(rfm)),
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
