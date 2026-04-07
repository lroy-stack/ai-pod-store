"""
Tests for podclaw.hooks.memory_hook
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from podclaw.hooks.memory_hook import memory_hook


def _make_memory_manager():
    mm = MagicMock()
    mm.append_daily = AsyncMock()
    return mm


def _make_event_queue():
    eq = AsyncMock()
    eq.push = AsyncMock()
    return eq


# ---------------------------------------------------------------------------
# High-level tool logging
# ---------------------------------------------------------------------------

class TestMemoryHookLogging:

    @pytest.mark.asyncio
    async def test_high_level_tool_logged(self):
        mm = _make_memory_manager()
        hook = memory_hook(mm)

        input_data = {
            "tool_name": "stripe_create_refund",
            "tool_input": {"charge_id": "ch_123", "amount": 500},
            "_agent_name": "customer_manager",
        }

        await hook(input_data, tool_use_id="tu-1")
        mm.append_daily.assert_called_once()
        call_args = mm.append_daily.call_args
        assert call_args[0][0] == "customer_manager"

    @pytest.mark.asyncio
    async def test_low_level_tool_not_logged(self):
        """supabase_query is NOT in HIGH_LEVEL_TOOLS → no daily memory entry."""
        mm = _make_memory_manager()
        hook = memory_hook(mm)

        input_data = {
            "tool_name": "supabase_query",
            "tool_input": {"table": "products"},
            "_agent_name": "researcher",
        }

        await hook(input_data, tool_use_id="tu-2")
        mm.append_daily.assert_not_called()


# ---------------------------------------------------------------------------
# High-priority event queue push
# ---------------------------------------------------------------------------

class TestHighPriorityPush:

    @pytest.mark.asyncio
    async def test_refund_pushes_to_queue(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "stripe_create_refund",
            "tool_input": {"charge_id": "ch_123", "amount": 500},
            "_agent_name": "customer_manager",
        }

        await hook(input_data, tool_use_id="tu-3")
        eq.push.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_product_pushes_to_queue(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "printify_delete_product",
            "tool_input": {"product_id": "p123"},
            "_agent_name": "cataloger",
        }

        await hook(input_data, tool_use_id="tu-4")
        eq.push.assert_called_once()

    @pytest.mark.asyncio
    async def test_normal_tool_no_push(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "supabase_query",
            "tool_input": {"table": "products"},
            "_agent_name": "researcher",
        }

        await hook(input_data, tool_use_id="tu-5")
        eq.push.assert_not_called()


# ---------------------------------------------------------------------------
# Finance pricing alert detection
# ---------------------------------------------------------------------------

class TestFinancePricingAlert:

    @pytest.mark.asyncio
    async def test_urgent_pricing_triggers_event(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "Write",
            "tool_input": {
                "file_path": "/workspace/memory/context/pricing_history.md",
                "content": "## URGENT: NEGATIVE_MARGIN on product X",
            },
            "_agent_name": "finance",
        }

        await hook(input_data, tool_use_id="tu-6")
        eq.push.assert_called_once()
        event = eq.push.call_args[0][0]
        assert event.event_type == "pricing_negative_margin"
        assert event.wake_mode == "now"
        assert event.target_agent == "cataloger"

    @pytest.mark.asyncio
    async def test_non_pricing_file_no_event(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "Write",
            "tool_input": {
                "file_path": "/workspace/memory/context/best_sellers.md",
                "content": "## URGENT note here",
            },
            "_agent_name": "finance",
        }

        await hook(input_data, tool_use_id="tu-7")
        eq.push.assert_not_called()


# ---------------------------------------------------------------------------
# Zombie product detection
# ---------------------------------------------------------------------------

class TestZombieDetection:

    @pytest.mark.asyncio
    async def test_zombie_products_trigger_event(self):
        mm = _make_memory_manager()
        eq = _make_event_queue()
        hook = memory_hook(mm, event_queue=eq)

        input_data = {
            "tool_name": "Write",
            "tool_input": {
                "file_path": "/workspace/memory/context/product_scorecard.md",
                "content": "Product A: ZOMBIE\nProduct B: ZOMBIE\nProduct C: active",
            },
            "_agent_name": "finance",
        }

        await hook(input_data, tool_use_id="tu-8")
        eq.push.assert_called_once()
        event = eq.push.call_args[0][0]
        assert event.event_type == "zombie_products_detected"
        assert event.payload["zombie_count"] == 2


# ---------------------------------------------------------------------------
# Hook always returns {}
# ---------------------------------------------------------------------------

class TestMemoryHookReturn:

    @pytest.mark.asyncio
    async def test_always_returns_empty_dict(self):
        mm = _make_memory_manager()
        hook = memory_hook(mm)
        result = await hook({
            "tool_name": "test",
            "tool_input": {},
            "_agent_name": "test",
        })
        assert result == {}
