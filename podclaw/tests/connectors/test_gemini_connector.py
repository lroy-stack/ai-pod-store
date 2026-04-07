"""
Tests for podclaw.connectors.gemini_connector — GeminiMCPConnector
"""

from __future__ import annotations

import json

import pytest
import respx
from httpx import Response

from podclaw.connectors.gemini_connector import GeminiMCPConnector, GEMINI_API

FAKE_KEY = "fake-gemini-key"


@pytest.fixture()
def connector():
    return GeminiMCPConnector(api_key=FAKE_KEY)


class TestToolRegistration:

    def test_get_tools_returns_all(self, connector):
        tools = connector.get_tools()
        expected = {"gemini_embed_text", "gemini_embed_batch", "gemini_generate_image", "gemini_check_image"}
        assert set(tools.keys()) == expected


class TestEmbedText:

    @respx.mock
    async def test_embed_text(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/gemini-embedding-001").mock(
            return_value=Response(200, json={
                "embedding": {"values": [0.1] * 768}
            })
        )
        result = await connector._embed_text({"text": "Hello world"})
        assert len(result["embedding"]) == 768


class TestEmbedBatch:

    @respx.mock
    async def test_embed_batch(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/gemini-embedding-001").mock(
            return_value=Response(200, json={
                "embeddings": [{"values": [0.1] * 768}, {"values": [0.2] * 768}]
            })
        )
        result = await connector._embed_batch({"texts": ["Hello", "World"]})
        assert result["count"] == 2
        assert len(result["embeddings"]) == 2


class TestGenerateImage:

    @respx.mock
    async def test_generate_image_success(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{
                    "content": {
                        "parts": [
                            {"inlineData": {"data": "base64imgdata", "mimeType": "image/png"}},
                            {"text": "Generated a phoenix"},
                        ]
                    }
                }]
            })
        )
        result = await connector._generate_image({"prompt": "phoenix rising"})
        assert result["image_base64"] == "base64imgdata"
        assert result["mime_type"] == "image/png"

    @respx.mock
    async def test_generate_image_no_candidates(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={"candidates": []})
        )
        result = await connector._generate_image({"prompt": "test"})
        assert "error" in result

    @respx.mock
    async def test_generate_image_no_image_data(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{"content": {"parts": [{"text": "Sorry I cant generate that"}]}}]
            })
        )
        result = await connector._generate_image({"prompt": "test"})
        assert "error" in result

    @respx.mock
    async def test_generate_image_api_error(self, connector):
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(400, text="Bad request")
        )
        result = await connector._generate_image({"prompt": "test"})
        assert "error" in result


class TestCheckImage:

    @respx.mock
    async def test_check_image_passes(self, connector):
        # Mock downloading the image
        respx.get("https://example.com/design.png").mock(
            return_value=Response(200, content=b"fake png bytes", headers={"content-type": "image/png"})
        )
        # Mock Gemini vision response
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps({
                            "passed": True,
                            "score": 8,
                            "issues": [],
                            "details": "Good quality design",
                        })}]
                    }
                }]
            })
        )
        result = await connector._check_image({"image_url": "https://example.com/design.png"})
        assert result["passed"] is True
        assert result["score"] == 8

    @respx.mock
    async def test_check_image_fails(self, connector):
        respx.get("https://example.com/bad.png").mock(
            return_value=Response(200, content=b"bytes", headers={"content-type": "image/png"})
        )
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps({
                            "passed": False,
                            "score": 4,
                            "issues": ["Deformed anatomy on left hand"],
                            "details": "Low quality, anatomy issues",
                        })}]
                    }
                }]
            })
        )
        result = await connector._check_image({"image_url": "https://example.com/bad.png"})
        assert result["passed"] is False
        assert result["score"] == 4

    @respx.mock
    async def test_check_image_score_10_capped(self, connector):
        """Perfect score 10 with no issues should be capped to 9."""
        respx.get("https://example.com/perfect.png").mock(
            return_value=Response(200, content=b"bytes", headers={"content-type": "image/png"})
        )
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps({
                            "passed": True,
                            "score": 10,
                            "issues": [],
                            "details": "Perfect",
                        })}]
                    }
                }]
            })
        )
        result = await connector._check_image({"image_url": "https://example.com/perfect.png"})
        assert result["score"] == 9  # Capped

    @respx.mock
    async def test_check_image_high_score_with_issues_capped(self, connector):
        """Score >= 9 with issues should be capped to 8."""
        respx.get("https://example.com/almost.png").mock(
            return_value=Response(200, content=b"bytes", headers={"content-type": "image/png"})
        )
        respx.post(url__startswith=f"{GEMINI_API}/models/").mock(
            return_value=Response(200, json={
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps({
                            "passed": True,
                            "score": 9,
                            "issues": ["Minor blurring in corner"],
                            "details": "Good but not perfect",
                        })}]
                    }
                }]
            })
        )
        result = await connector._check_image({"image_url": "https://example.com/almost.png"})
        assert result["score"] == 8  # Capped due to issues

    @respx.mock
    async def test_check_image_download_failure(self, connector):
        respx.get("https://example.com/404.png").mock(
            return_value=Response(404, text="Not found")
        )
        result = await connector._check_image({"image_url": "https://example.com/404.png"})
        assert result["passed"] is False
        assert result["score"] == 0
