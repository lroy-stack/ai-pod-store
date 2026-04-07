"""
Tests for podclaw.connectors.svg_renderer_connector — SVGRendererConnector
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from podclaw.connectors.svg_renderer_connector import SVGRendererConnector

BASE = "http://svg-renderer:3002"

SIMPLE_SVG = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
# Fake 1x1 PNG (smallest valid PNG)
FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50


@pytest.fixture()
def connector():
    return SVGRendererConnector(base_url=BASE)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

class TestToolRegistration:

    def test_get_tools_returns_two(self, connector):
        tools = connector.get_tools()
        assert len(tools) == 2
        assert "svg_render_png" in tools
        assert "svg_composite" in tools

    def test_each_tool_has_handler(self, connector):
        for name, tool in connector.get_tools().items():
            assert callable(tool["handler"]), f"{name} missing handler"

    def test_each_tool_has_description(self, connector):
        for name, tool in connector.get_tools().items():
            assert "description" in tool
            assert len(tool["description"]) > 10

    def test_render_tool_parameters(self, connector):
        tool = connector.get_tools()["svg_render_png"]
        params = tool["parameters"]["properties"]
        assert "svg" in params
        assert "width" in params
        assert "height" in params
        assert "dpi" in params
        assert "background" in params


# ---------------------------------------------------------------------------
# Render endpoint
# ---------------------------------------------------------------------------

class TestRender:

    @pytest.mark.asyncio
    @respx.mock
    async def test_render_success(self, connector):
        respx.post(f"{BASE}/render").mock(
            return_value=Response(200, content=FAKE_PNG)
        )
        tools = connector.get_tools()
        result = await tools["svg_render_png"]["handler"]({
            "svg": SIMPLE_SVG,
            "width": 1000,
            "height": 1000,
            "dpi": 300,
        })
        assert result["success"] is True
        assert "png_base64" in result
        assert result["width"] == 1000
        assert result["height"] == 1000
        assert result["dpi"] == 300
        assert result["size_bytes"] > 0

    @pytest.mark.asyncio
    @respx.mock
    async def test_render_with_background(self, connector):
        respx.post(f"{BASE}/render").mock(
            return_value=Response(200, content=FAKE_PNG)
        )
        tools = connector.get_tools()
        result = await tools["svg_render_png"]["handler"]({
            "svg": SIMPLE_SVG,
            "width": 500,
            "height": 500,
            "background": "white",
        })
        assert result["success"] is True

    @pytest.mark.asyncio
    @respx.mock
    async def test_render_error(self, connector):
        respx.post(f"{BASE}/render").mock(
            return_value=Response(500, json={"error": True, "message": "Invalid SVG"})
        )
        tools = connector.get_tools()
        result = await tools["svg_render_png"]["handler"]({
            "svg": "not valid svg",
            "width": 100,
            "height": 100,
        })
        assert result["success"] is False
        assert "error" in result


# ---------------------------------------------------------------------------
# Composite endpoint
# ---------------------------------------------------------------------------

class TestComposite:

    @pytest.mark.asyncio
    @respx.mock
    async def test_composite_success(self, connector):
        respx.post(f"{BASE}/composite").mock(
            return_value=Response(200, content=FAKE_PNG)
        )
        tools = connector.get_tools()
        result = await tools["svg_composite"]["handler"]({
            "layers": [
                {"type": "svg", "content": SIMPLE_SVG, "x": 0, "y": 0},
            ],
            "width": 4500,
            "height": 5400,
            "dpi": 300,
        })
        assert result["success"] is True
        assert "png_base64" in result

    @pytest.mark.asyncio
    @respx.mock
    async def test_composite_error(self, connector):
        respx.post(f"{BASE}/composite").mock(
            return_value=Response(500, json={"error": True, "message": "Composite failed"})
        )
        tools = connector.get_tools()
        result = await tools["svg_composite"]["handler"]({
            "layers": [],
            "width": 100,
            "height": 100,
        })
        assert result["success"] is False
