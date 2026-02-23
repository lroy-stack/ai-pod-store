"""
Tests for podclaw.hooks.event_log_hook
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from podclaw.hooks.event_log_hook import event_log_hook


# ---------------------------------------------------------------------------
# Event logging
# ---------------------------------------------------------------------------

class TestEventLogHook:

    @pytest.mark.asyncio
    async def test_records_tool_call_event(self):
        """Hook should call event_store.record with correct parameters."""
        mock_store = AsyncMock()
        mock_store.record = AsyncMock(return_value="event-123")

        hook = event_log_hook(mock_store)

        input_data = {
            "tool_name": "supabase_query",
            "tool_input": {"table": "products", "select": "*"},
            "tool_output": '{"data": []}',
            "_agent_name": "researcher",
            "_session_id": "sess-001",
        }

        result = await hook(input_data, tool_use_id="tu-1")
        assert result == {}

        mock_store.record.assert_called_once()
        call_kwargs = mock_store.record.call_args.kwargs
        assert call_kwargs["agent_name"] == "researcher"
        assert call_kwargs["event_type"] == "tool_call"
        assert call_kwargs["session_id"] == "sess-001"
        assert "tool" in call_kwargs["payload"]
        assert call_kwargs["payload"]["tool"] == "supabase_query"

    @pytest.mark.asyncio
    async def test_records_input_keys(self):
        mock_store = AsyncMock()
        mock_store.record = AsyncMock(return_value="event-456")

        hook = event_log_hook(mock_store)

        input_data = {
            "tool_name": "printify_create",
            "tool_input": {"title": "T-Shirt", "blueprint_id": 5},
            "tool_output": '{"id": "abc"}',
            "_agent_name": "cataloger",
        }

        await hook(input_data, tool_use_id="tu-2")

        call_kwargs = mock_store.record.call_args.kwargs
        assert "title" in call_kwargs["payload"]["input_keys"]
        assert "blueprint_id" in call_kwargs["payload"]["input_keys"]

    @pytest.mark.asyncio
    async def test_records_error_status(self):
        mock_store = AsyncMock()
        mock_store.record = AsyncMock(return_value="event-789")

        hook = event_log_hook(mock_store)

        input_data = {
            "tool_name": "fal_generate",
            "tool_input": {"prompt": "cat"},
            "tool_output": "",
            "_agent_name": "designer",
            "_error": True,
        }

        await hook(input_data, tool_use_id="tu-3")

        call_kwargs = mock_store.record.call_args.kwargs
        assert call_kwargs["payload"]["success"] is False

    @pytest.mark.asyncio
    async def test_always_returns_empty_dict(self):
        """PostToolUse hooks should never block (always return {})."""
        mock_store = AsyncMock()
        mock_store.record = AsyncMock(return_value="e")

        hook = event_log_hook(mock_store)
        result = await hook({
            "tool_name": "test", "tool_input": {}, "tool_output": "",
            "_agent_name": "test",
        })
        assert result == {}
