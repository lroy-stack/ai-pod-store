"""
Tests for podclaw.pricing.engagement_price()
"""

from __future__ import annotations

from podclaw.pricing import engagement_price


class TestEngagementPriceMultipliers:
    """Verify product-type-aware multipliers from the Cataloger pricing table."""

    def test_tshirt_multiplier(self):
        """T-shirt titles should use the 1.8x multiplier."""
        # cost 1000 cents => 1000 * 1.8 = 1800 => ceil(1800/100)*100 - 1 = 1799
        result = engagement_price(1000, "Cool T-Shirt Design")
        assert result == 1799

    def test_mug_multiplier(self):
        """Mug titles should use the 2.0x multiplier."""
        # cost 800 cents => 800 * 2.0 = 1600 => ceil(1600/100)*100 - 1 = 1599
        result = engagement_price(800, "Funny Coffee Mug")
        assert result == 1599

    def test_hoodie_multiplier(self):
        """Hoodie titles should use the 1.7x multiplier."""
        # cost 2500 cents => 2500 * 1.7 = 4250 => ceil(4250/100)*100 - 1 = 4299
        result = engagement_price(2500, "Premium Hoodie Black")
        assert result == 4299

    def test_sticker_multiplier(self):
        """Sticker titles should use the 2.5x multiplier."""
        # cost 200 cents => 200 * 2.5 = 500 => ceil(500/100)*100 - 1 = 499
        # But min_price for stickers is 399, and 499 > 399, so 499
        result = engagement_price(200, "Vinyl Sticker Pack")
        assert result == 499

    def test_default_unknown_product(self):
        """Unknown product types should fall back to the 1.8x default multiplier."""
        # cost 1000 cents => 1000 * 1.8 = 1800 => ceil(1800/100)*100 - 1 = 1799
        result = engagement_price(1000, "Mystery Item XYZ")
        assert result == 1799


class TestEngagementPriceFloors:
    """Verify minimum price floors and margin constraints."""

    def test_minimum_price_floor_margin(self):
        """Price must guarantee at least 40% margin (MINIMUM_MARKUP_MULTIPLIER=1.4).

        When the product-type multiplier would produce a price below the 1.4x floor,
        the floor takes over.
        """
        # A very cheap hoodie: cost 100 cents, multiplier 1.7 => 170
        # Floor 1.4x => 140.  170 > 140 so multiplier wins.
        # ceil(170/100)*100 - 1 = 199
        # But min_price for hoodie is 2999, so result = 2999
        result = engagement_price(100, "Budget Hoodie")
        assert result == 2999

    def test_dot_99_ending(self):
        """Prices should always end in 99 (the .99 engagement pricing pattern)."""
        result = engagement_price(1234, "Cool T-Shirt Design")
        assert result % 100 == 99

    def test_zero_cost_input(self):
        """Zero cost should return the product-type minimum price."""
        # cost 0 => raw = 0 * 1.8 = 0, floor = 0 * 1.4 = 0
        # ceil(0/100)*100 - 1 = -1, but max(-1, 1499) = 1499
        result = engagement_price(0, "Free T-Shirt Promo")
        assert result == 1499

    def test_sticker_minimum_price(self):
        """Even very cheap stickers should hit the 399 minimum."""
        result = engagement_price(10, "Tiny Sticker")
        assert result == 399

    def test_mug_minimum_price(self):
        """Even very cheap mugs should hit the 999 minimum."""
        result = engagement_price(10, "Mini Mug")
        assert result == 999
