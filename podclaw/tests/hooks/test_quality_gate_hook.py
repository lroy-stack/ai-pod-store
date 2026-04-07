"""
Tests for podclaw.hooks.quality_gate_hook
"""

from __future__ import annotations

import json

import pytest
from unittest.mock import AsyncMock

from podclaw.hooks.quality_gate_hook import quality_gate_hook


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_hook(event_queue=None):
    """Create quality_gate_hook with fake Supabase creds."""
    return quality_gate_hook(
        supabase_url="http://fake-supabase.local",
        supabase_key="fake-key",
        event_queue=event_queue,
    )


# ---------------------------------------------------------------------------
# Image generation checks
# ---------------------------------------------------------------------------

class TestImageGenerationGate:

    @pytest.mark.asyncio
    async def test_no_image_url_logs_error(self):
        """When image generation produces no image_url, hook should log error."""
        eq = AsyncMock()
        eq.push = AsyncMock()
        hook = _make_hook(event_queue=eq)

        input_data = {
            "tool_name": "fal_generate",
            "tool_input": {"prompt": "cat"},
            "tool_output": json.dumps({"error": "rate limited"}),
            "_agent_name": "designer",
        }

        result = await hook(input_data, tool_use_id="tu-1")
        assert result == {}
        eq.push.assert_called_once()

    @pytest.mark.asyncio
    async def test_valid_image_passes(self):
        eq = AsyncMock()
        eq.push = AsyncMock()
        hook = _make_hook(event_queue=eq)

        input_data = {
            "tool_name": "fal_generate",
            "tool_input": {"prompt": "cat"},
            "tool_output": json.dumps({"image_url": "https://example.com/cat.png"}),
            "_agent_name": "designer",
        }

        result = await hook(input_data, tool_use_id="tu-2")
        assert result == {}
        eq.push.assert_not_called()

    @pytest.mark.asyncio
    async def test_images_list_also_valid(self):
        eq = AsyncMock()
        eq.push = AsyncMock()
        hook = _make_hook(event_queue=eq)

        input_data = {
            "tool_name": "gemini_generate_image",
            "tool_input": {"prompt": "dog"},
            "tool_output": json.dumps({"images": [{"url": "https://example.com/dog.png"}]}),
            "_agent_name": "designer",
        }

        result = await hook(input_data, tool_use_id="tu-3")
        assert result == {}
        eq.push.assert_not_called()


# ---------------------------------------------------------------------------
# Product insert checks
# ---------------------------------------------------------------------------

class TestProductInsertGate:

    @pytest.mark.asyncio
    async def test_json_in_description_warns(self):
        hook = _make_hook()

        input_data = {
            "tool_name": "supabase_insert",
            "tool_input": {"table": "products", "data": {"title": "Test"}},
            "tool_output": json.dumps({
                "title": "Test",
                "description": '{"en": "English desc"}',
            }),
            "_agent_name": "cataloger",
        }

        # Should not crash — just logs warning
        result = await hook(input_data, tool_use_id="tu-4")
        assert result == {}

    @pytest.mark.asyncio
    async def test_design_without_image_url(self):
        hook = _make_hook()

        input_data = {
            "tool_name": "supabase_insert",
            "tool_input": {"table": "designs", "data": {"prompt": "cat"}},
            "tool_output": "",
            "_agent_name": "designer",
        }

        result = await hook(input_data, tool_use_id="tu-5")
        assert result == {}


# ---------------------------------------------------------------------------
# Non-matching tools pass through
# ---------------------------------------------------------------------------

class TestPassthrough:

    @pytest.mark.asyncio
    async def test_unrelated_tool_passes(self):
        hook = _make_hook()
        input_data = {
            "tool_name": "crawl_url",
            "tool_input": {"url": "https://example.com"},
            "tool_output": "page content",
            "_agent_name": "researcher",
        }

        result = await hook(input_data, tool_use_id="tu-6")
        assert result == {}

    @pytest.mark.asyncio
    async def test_always_returns_empty_dict(self):
        hook = _make_hook()
        result = await hook({
            "tool_name": "unknown",
            "tool_input": {},
            "tool_output": "",
            "_agent_name": "test",
        })
        assert result == {}
