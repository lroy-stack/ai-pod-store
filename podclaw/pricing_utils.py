"""
PodClaw — Engagement Pricing Utilities
========================================

Converts Printify USD cost → EUR retail price with engagement-friendly endings.

Rules:
  1. USD → EUR conversion (0.92 rate)
  2. 1.4x markup (40% gross margin minimum)
  3. Floor: max(cost_eur × 1.4, cost_eur + 200) — dynamic based on real cost
  4. Round UP to nearest engagement ending:
     - Under EUR 20: .99
     - EUR 20-49: .99
     - EUR 50-99: .00, .50, .95, .99
     - EUR 100+: .00, .50
"""

from __future__ import annotations

from podclaw.config import (
    MINIMUM_MARKUP_MULTIPLIER,
    PRINTIFY_USD_TO_EUR_RATE,
)

# Engagement endings per price range (cents within the euro).
# Order matters: PREFERRED ending listed FIRST (algorithm picks first match >= remainder).
_ENDINGS: list[tuple[int, list[int]]] = [
    (2000, [99]),             # < EUR 20: .99 only
    (5000, [99]),             # EUR 20-49: .99 (standard retail: €24.99, €29.99, €39.99)
    (10000, [0, 50, 95, 99]),  # EUR 50-99: .00, .50, .95, .99
]
_ENDINGS_HIGH: list[int] = [0, 50]  # EUR 100+: .00, .50


def _valid_endings(price_cents: int) -> list[int]:
    """Return valid cent endings for the given price range."""
    for threshold, endings in _ENDINGS:
        if price_cents < threshold:
            return endings
    return _ENDINGS_HIGH


def _round_to_engagement(price_cents: int) -> int:
    """Round price UP to the nearest valid engagement ending. Never rounds down."""
    euros = price_cents // 100
    remainder = price_cents % 100
    endings = _valid_endings(price_cents)

    # Try current euro amount first — find the smallest ending >= remainder
    for ending in sorted(endings):
        if ending >= remainder:
            candidate = euros * 100 + ending
            if candidate >= price_cents:
                return candidate

    # No ending fits in current euro — bump to next euro
    next_euros = euros + 1
    next_price = next_euros * 100
    next_endings = _valid_endings(next_price)
    return next_euros * 100 + min(next_endings)


def cost_to_engagement_price(cost_usd_cents: int) -> int:
    """
    Convert Printify USD cost (cents) to EUR retail price with engagement rounding.

    Dynamic floor: max(cost_eur × markup, cost_eur + 200) — ensures at least
    40% margin OR €2.00 profit, whichever is higher.

    Example:
      cost=142 USD → 131 EUR → 183 raw → max(183,331) → 331 → 499 = EUR 4.99
      cost=580 USD → 534 EUR → 748 raw → max(748,734) → 748 → 799 = EUR 7.99
      cost=1200 USD → 1104 EUR → 1546 raw → 1599 = EUR 15.99
    """
    cost_eur = int(cost_usd_cents * PRINTIFY_USD_TO_EUR_RATE)
    raw_markup = int(cost_eur * MINIMUM_MARKUP_MULTIPLIER)
    raw_min_profit = cost_eur + 200  # at least EUR 2.00 profit
    raw = max(raw_markup, raw_min_profit)
    return _round_to_engagement(raw)
