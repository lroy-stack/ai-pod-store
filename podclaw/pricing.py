"""
PodClaw — Canonical Pricing Engine
=====================================

Single source of truth for Printify cost → EUR retail price conversion.

Two pricing strategies:
  1. engagement_price() — product-type-aware multipliers (Cataloger SKILL.md table)
  2. cost_to_engagement_price() — simple markup with engagement-friendly endings

All scripts, hooks, and reconciliation tools MUST import from here.
"""

from __future__ import annotations

import math

from podclaw.config import (
    MINIMUM_MARKUP_MULTIPLIER,
    PRINTIFY_USD_TO_EUR_RATE,
)


def engagement_price(cost_cents_eur: int, title: str = "") -> int:
    """Calculate retail price from EUR cost using tiered multipliers, rounded to .99.

    Uses product-type-aware multipliers matching the Cataloger SKILL.md pricing table.
    Falls back to x1.8 when product type cannot be determined from the title.

    Args:
        cost_cents_eur: Cost in EUR cents (already converted from USD).
        title: Product title for product-type detection.

    Returns:
        Retail price in EUR cents (e.g. 1499 = €14.99).
    """
    title_lower = title.lower()

    # Determine multiplier and minimum price based on product type
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
        multiplier, min_price = 1.8, 1499  # default: apparel-like

    raw = cost_cents_eur * multiplier

    # Hard floor: at least 40% margin
    floor = cost_cents_eur * MINIMUM_MARKUP_MULTIPLIER
    raw = max(raw, floor)

    # Hard ceiling: at most 3x cost
    ceiling = cost_cents_eur * 3.0
    raw = min(raw, ceiling)

    # Round up to nearest .99
    rounded = math.ceil(raw / 100) * 100 - 1

    # Apply minimum price for the product type
    return max(rounded, min_price)


def usd_to_eur_cents(cost_usd_cents: int) -> int:
    """Convert Printify USD cents to EUR cents using the configured rate."""
    return int(cost_usd_cents * PRINTIFY_USD_TO_EUR_RATE)
