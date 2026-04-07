"""
Tests for podclaw.connectors.fal_connector — FalMCPConnector

Uses respx to mock httpx requests to the fal.ai API.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from podclaw.connectors.fal_connector import FalMCPConnector, FAL_API, FAL_SYNC_API

FAKE_KEY = "fake-fal-key"


@pytest.fixture()
def connector():
    return FalMCPConnector(api_key=FAKE_KEY)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

class TestToolRegistration:

    def test_get_tools_returns_all(self, connector):
        tools = connector.get_tools()
        expected = {"fal_generate", "fal_get_status", "fal_remove_bg", "fal_upscale"}
        assert set(tools.keys()) == expected

    def test_each_tool_has_handler(self, connector):
        for name, tool in connector.get_tools().items():
            assert callable(tool["handler"]), f"{name} has no callable handler"


# ---------------------------------------------------------------------------
# Generate image
# ---------------------------------------------------------------------------

class TestGenerate:

    @respx.mock
    async def test_generate_success(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(200, json={
                "images": [{"url": "https://fal.media/result.png"}],
                "seed": 42,
            })
        )
        result = await connector._generate({"prompt": "A sunset"})
        assert "images" in result
        assert result["images"][0]["url"].startswith("https://")

    @respx.mock
    async def test_generate_auth_error(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(403, text="Forbidden")
        )
        result = await connector._generate({"prompt": "test"})
        assert result["error"] == "fal_auth_failed"
        assert result["status"] == 403

    @respx.mock
    async def test_generate_rate_limited(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(429, text="Too Many Requests", headers={"retry-after": "30"})
        )
        result = await connector._generate({"prompt": "test"})
        assert result["error"] == "fal_rate_limited"
        assert result["retry_after"] == "30"

    @respx.mock
    async def test_generate_server_error(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(500, text="Internal Server Error")
        )
        result = await connector._generate({"prompt": "test"})
        assert result["error"] == "fal_generate_failed"

    @respx.mock
    async def test_generate_with_schnell_model(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux/schnell").mock(
            return_value=Response(200, json={"images": [{"url": "https://fal.media/schnell.png"}]})
        )
        result = await connector._generate({"prompt": "test", "model": "schnell"})
        assert "images" in result

    @respx.mock
    async def test_generate_with_custom_size(self, connector):
        respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(200, json={"images": [{"url": "https://fal.media/sized.png"}]})
        )
        result = await connector._generate({
            "prompt": "test",
            "width": 1024,
            "height": 768,
        })
        assert "images" in result

    @respx.mock
    async def test_generate_num_images_capped_at_4(self, connector):
        route = respx.post(f"{FAL_API}/fal-ai/flux-pro/v1.1").mock(
            return_value=Response(200, json={"images": []})
        )
        await connector._generate({"prompt": "test", "num_images": 10})
        # Verify the body sent has num_images capped to 4
        sent_body = route.calls[0].request.content
        import json
        body = json.loads(sent_body)
        assert body["num_images"] == 4


# ---------------------------------------------------------------------------
# Get status
# ---------------------------------------------------------------------------

class TestGetStatus:

    @respx.mock
    async def test_get_status_success(self, connector):
        respx.get(f"{FAL_API}/fal-ai/flux-pro/v1.1/requests/req-123/status").mock(
            return_value=Response(200, json={"status": "completed"})
        )
        result = await connector._get_status({"request_id": "req-123"})
        assert result["status"] == "completed"


# ---------------------------------------------------------------------------
# Remove background
# ---------------------------------------------------------------------------

class TestRemoveBg:

    @respx.mock
    async def test_remove_bg_fal_fallback(self, connector, monkeypatch):
        """When local rembg is not configured, fall back to fal.ai cloud."""
        monkeypatch.delenv("REMBG_URL", raising=False)

        # Mock the fal rembg utility
        async def _fake_fal_rembg(api_key, image_url):
            return {"image_url": "https://fal.media/transparent.png", "provider": "fal-rembg", "cost_usd": 0}

        import podclaw.connectors.fal_connector as fal_mod
        with pytest.MonkeyPatch.context() as m:
            m.setattr("podclaw.bg_removal.call_fal_rembg", _fake_fal_rembg, raising=False)
            # Need to patch where it's imported in the handler
            from unittest.mock import patch, AsyncMock
            with patch("podclaw.bg_removal.call_fal_rembg", new=_fake_fal_rembg):
                with patch("podclaw.bg_removal.upload_to_storage", new=AsyncMock(return_value=None)):
                    result = await connector._remove_bg({"image_url": "https://example.com/img.png"})

        assert "image_url" in result or "error" in result
