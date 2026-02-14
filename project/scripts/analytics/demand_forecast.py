#!/usr/bin/env python3
"""Demand Forecasting.

Uses simple exponential smoothing and linear regression on daily order
counts to forecast the next 30 days with confidence intervals.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from scipy import stats

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_orders


def _exponential_smoothing(series: np.ndarray, alpha: float = 0.3) -> np.ndarray:
    """Simple exponential smoothing.

    Args:
        series: Array of observed values.
        alpha: Smoothing factor (0 < alpha < 1).

    Returns:
        Array of smoothed values (same length as input).
    """
    result = np.zeros_like(series, dtype=float)
    result[0] = series[0]
    for i in range(1, len(series)):
        result[i] = alpha * series[i] + (1 - alpha) * result[i - 1]
    return result


def run() -> dict:
    """Run demand forecast.

    Returns:
        Dict with forecast list, trend direction, and avg_daily_orders.
    """
    orders = get_orders(days=180)

    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=180)).date()

    # Build daily counts
    daily_counts: dict[str, int] = {}
    for order in orders:
        created_at = order.get("created_at", "")
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            day_str = dt.strftime("%Y-%m-%d")
            daily_counts[day_str] = daily_counts.get(day_str, 0) + 1
        except (ValueError, AttributeError):
            continue

    # Fill missing days with 0
    date_range = pd.date_range(start=start_date, end=now.date(), freq="D")
    counts = np.array([daily_counts.get(d.strftime("%Y-%m-%d"), 0) for d in date_range], dtype=float)

    if len(counts) < 7:
        return {
            "forecast": [],
            "trend": "stable",
            "avg_daily_orders": 0,
        }

    avg_daily = float(np.mean(counts))

    # Linear regression for trend
    x = np.arange(len(counts))
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, counts)

    # Determine trend direction
    if slope > 0.05 and p_value < 0.1:
        trend = "increasing"
    elif slope < -0.05 and p_value < 0.1:
        trend = "decreasing"
    else:
        trend = "stable"

    # Forecast next 30 days using linear regression + smoothed residuals
    smoothed = _exponential_smoothing(counts, alpha=0.3)
    residual_std = float(np.std(counts - smoothed))

    forecast = []
    for i in range(1, 31):
        future_x = len(counts) + i - 1
        predicted = slope * future_x + intercept
        # Blend with last smoothed value for short-term accuracy
        weight = max(0.0, 1.0 - i / 30.0)
        blended = weight * smoothed[-1] + (1 - weight) * predicted
        blended = max(0, blended)

        # Confidence intervals widen over time
        margin = 1.96 * residual_std * np.sqrt(1 + i / len(counts))
        lower = max(0, blended - margin)
        upper = blended + margin

        forecast_date = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        forecast.append({
            "date": forecast_date,
            "predicted_orders": round(float(blended), 1),
            "lower": round(float(lower), 1),
            "upper": round(float(upper), 1),
        })

    return {
        "forecast": forecast,
        "trend": trend,
        "avg_daily_orders": round(avg_daily, 2),
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
