"""
Tests for podclaw.hooks.security_hook
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

import podclaw.hooks.security_hook as security_mod
from podclaw.hooks.security_hook import (
    security_hook,
    READONLY_TOOLS,
    BLOCKED_TOOLS,
    PROTECTED_TABLES,
    ALLOWED_RPC_FUNCTIONS,
    init_security,
    enable_readonly,
    disable_readonly,
    is_readonly,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _input(tool_name: str, tool_input: dict = None, agent: str = "designer") -> dict:
    return {
        "tool_name": tool_name,
        "tool_input": tool_input or {},
        "_agent_name": agent,
    }


def _is_deny(result: dict) -> bool:
    hook_output = result.get("hookSpecificOutput", {})
    return hook_output.get("permissionDecision") == "deny"


def _is_allow(result: dict) -> bool:
    return result == {} or result.get("hookSpecificOutput", {}).get("permissionDecision") != "deny"


# ---------------------------------------------------------------------------
# Read-only tools — always allowed
# ---------------------------------------------------------------------------

class TestReadonlyTools:

    @pytest.mark.asyncio
    async def test_readonly_tools_allowed(self):
        for tool in ["supabase_query", "printify_list_products", "crawl_url", "gemini_embed_text"]:
            result = await security_hook(_input(tool))
            assert _is_allow(result), f"{tool} should be allowed"

    @pytest.mark.asyncio
    async def test_all_readonly_tools_are_covered(self):
        assert len(READONLY_TOOLS) > 20


# ---------------------------------------------------------------------------
# Blocked tools — always denied
# ---------------------------------------------------------------------------

class TestBlockedTools:

    @pytest.mark.asyncio
    async def test_blocked_tools_denied(self):
        for tool in BLOCKED_TOOLS:
            result = await security_hook(_input(tool))
            assert _is_deny(result), f"{tool} should be denied"

    @pytest.mark.asyncio
    async def test_supabase_drop_table_denied(self):
        result = await security_hook(_input("supabase_drop_table"))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_supabase_truncate_denied(self):
        result = await security_hook(_input("supabase_truncate"))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Protected tables — no agent writes
# ---------------------------------------------------------------------------

class TestProtectedTables:

    @pytest.mark.asyncio
    async def test_insert_into_users_denied(self):
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "users", "data": {"email": "test@test.com"}},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_update_orders_denied(self):
        result = await security_hook(_input(
            "supabase_update",
            {"table": "orders", "data": {"status": "shipped"}},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_delete_payments_denied(self):
        result = await security_hook(_input(
            "supabase_delete",
            {"table": "payments"},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_insert_into_products_allowed(self):
        """products is NOT in PROTECTED_TABLES."""
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {"title": "Test", "base_price_cents": 2999}},
        ))
        assert _is_allow(result)


# ---------------------------------------------------------------------------
# Refund checks
# ---------------------------------------------------------------------------

class TestRefundChecks:

    @pytest.mark.asyncio
    async def test_full_refund_without_amount_denied(self):
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123"},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_zero_amount_refund_denied(self):
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123", "amount": 0},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_small_refund_allowed(self):
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123", "amount": 500},  # $5.00
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_large_refund_denied(self):
        """Refund > EUR 25 threshold."""
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123", "amount": 15000},  # EUR 150.00
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_refund_at_exact_threshold_allowed(self):
        """Refund at exactly EUR 25 (2500 cents) should be allowed."""
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123", "amount": 2500},  # EUR 25.00
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_refund_one_cent_over_threshold_denied(self):
        """Refund at EUR 25.01 (2501 cents) should be denied."""
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_123", "amount": 2501},  # EUR 25.01
        ))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Bulk deletion checks
# ---------------------------------------------------------------------------

class TestBulkDeletion:

    @pytest.mark.asyncio
    async def test_small_deletion_allowed(self):
        result = await security_hook(_input(
            "supabase_delete",
            {"table": "designs", "ids": ["a", "b", "c"]},
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_bulk_deletion_denied(self):
        ids = [f"id_{i}" for i in range(15)]
        result = await security_hook(_input(
            "supabase_delete",
            {"table": "designs", "ids": ids},
        ))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# RPC whitelist
# ---------------------------------------------------------------------------

class TestRpcWhitelist:

    @pytest.mark.asyncio
    async def test_allowed_rpc_passes(self):
        result = await security_hook(_input(
            "supabase_rpc",
            {"function_name": "match_products"},
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_unknown_rpc_denied(self):
        result = await security_hook(_input(
            "supabase_rpc",
            {"function_name": "evil_function"},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_invalid_rpc_name_denied(self):
        result = await security_hook(_input(
            "supabase_rpc",
            {"function_name": "DROP TABLE; --"},
        ))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Price validation
# ---------------------------------------------------------------------------

class TestPriceValidation:

    @pytest.mark.asyncio
    async def test_price_below_absolute_minimum_denied(self):
        """EUR 2.99 absolute floor."""
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {"title": "Cheap", "base_price_cents": 100}},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_price_above_minimum_allowed(self):
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {"title": "Normal", "base_price_cents": 2999}},
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_price_below_dynamic_floor_denied(self):
        """cost_cents * 1.4 (MINIMUM_MARKUP_MULTIPLIER)."""
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {
                "title": "Bad Margin",
                "base_price_cents": 1000,
                "cost_cents": 900,
            }},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_price_with_good_margin_allowed(self):
        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {
                "title": "Good Margin",
                "base_price_cents": 2999,
                "cost_cents": 800,
            }},
        ))
        assert _is_allow(result)


# ---------------------------------------------------------------------------
# Printify publish — quality gate (fail-closed)
# ---------------------------------------------------------------------------

class TestPrintifyPublishGate:

    @pytest.mark.asyncio
    async def test_publish_without_product_id_denied(self):
        result = await security_hook(_input(
            "printify_publish",
            {},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_publish_without_supabase_denied(self):
        """No Supabase client → fail-closed."""
        # security_hook uses module-level _supabase_client which defaults to None
        init_security(None)
        result = await security_hook(_input(
            "printify_publish",
            {"product_id": "abc123"},
        ))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Order safety
# ---------------------------------------------------------------------------

class TestOrderSafety:

    @pytest.mark.asyncio
    async def test_small_order_allowed(self):
        result = await security_hook(_input(
            "printify_create_order",
            {"line_items": [{"variant_id": "v1", "quantity": 2}]},
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_oversized_order_denied(self):
        items = [{"variant_id": f"v{i}", "quantity": 3} for i in range(10)]
        result = await security_hook(_input(
            "printify_create_order",
            {"line_items": items},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_invalid_line_items_denied(self):
        result = await security_hook(_input(
            "printify_create_order",
            {"line_items": "not a list"},
        ))
        assert _is_deny(result)


# ---------------------------------------------------------------------------
# Dedup check
# ---------------------------------------------------------------------------

class TestDuplicateProductCheck:

    @pytest.mark.asyncio
    async def test_duplicate_title_denied(self):
        """If _check_duplicate_title returns an ID, insert should be denied."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "existing-123", "status": "active"}]
        )
        init_security(mock_client)

        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {"title": "Existing Product", "base_price_cents": 2999}},
        ))
        assert _is_deny(result)

        # Clean up
        init_security(None)

    @pytest.mark.asyncio
    async def test_new_title_allowed(self):
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        init_security(mock_client)

        result = await security_hook(_input(
            "supabase_insert",
            {"table": "products", "data": {"title": "Brand New Product", "base_price_cents": 2999}},
        ))
        assert _is_allow(result)

        init_security(None)


# ---------------------------------------------------------------------------
# Daily refund limit
# ---------------------------------------------------------------------------

class TestDailyRefundLimit:

    @pytest.mark.asyncio
    async def test_single_refund_within_daily_limit(self):
        """A single small refund should pass."""
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_1", "amount": 1000},  # EUR 10
        ))
        assert _is_allow(result)

    @pytest.mark.asyncio
    async def test_accumulated_refunds_exceed_daily_limit(self):
        """Multiple refunds exceeding EUR 150 daily cap should be denied."""
        # Issue 6 refunds of EUR 24 each = EUR 144 → under limit
        for i in range(6):
            result = await security_hook(_input(
                "stripe_create_refund",
                {"charge_id": f"ch_{i}", "amount": 2400},
            ))
            assert _is_allow(result), f"Refund {i} should be allowed"

        # 7th refund of EUR 24 = EUR 168 → exceeds EUR 150
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_overflow", "amount": 2400},
        ))
        assert _is_deny(result)

    @pytest.mark.asyncio
    async def test_daily_limit_resets_on_new_day(self):
        """Changing the date should reset the accumulator."""
        from datetime import date, timedelta

        # Fill up to EUR 140
        for i in range(7):
            await security_hook(_input(
                "stripe_create_refund",
                {"charge_id": f"ch_d{i}", "amount": 2000},
            ))

        # Simulate next day by changing _daily_refund_date
        security_mod._daily_refund_date = date.today() - timedelta(days=1)

        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_newday", "amount": 2000},
        ))
        assert _is_allow(result)


# ---------------------------------------------------------------------------
# Read-only mode
# ---------------------------------------------------------------------------

class TestReadOnlyMode:

    @pytest.mark.asyncio
    async def test_readonly_blocks_writes(self):
        enable_readonly()
        result = await security_hook(_input("supabase_insert", {"table": "products", "data": {}}))
        assert _is_deny(result)
        disable_readonly()

    @pytest.mark.asyncio
    async def test_readonly_allows_reads(self):
        enable_readonly()
        result = await security_hook(_input("supabase_query", {"table": "products"}))
        assert _is_allow(result)
        disable_readonly()

    @pytest.mark.asyncio
    async def test_readonly_blocks_refunds(self):
        enable_readonly()
        result = await security_hook(_input(
            "stripe_create_refund",
            {"charge_id": "ch_1", "amount": 500},
        ))
        assert _is_deny(result)
        disable_readonly()

    @pytest.mark.asyncio
    async def test_readonly_blocks_printify_create(self):
        enable_readonly()
        result = await security_hook(_input("printify_create", {"title": "test"}))
        assert _is_deny(result)
        disable_readonly()

    @pytest.mark.asyncio
    async def test_disable_readonly_restores_writes(self):
        enable_readonly()
        assert is_readonly() is True
        disable_readonly()
        assert is_readonly() is False
        result = await security_hook(_input("supabase_insert", {"table": "designs", "data": {"title": "ok"}}))
        assert _is_allow(result)
