"""
Tests for podclaw.connectors.crawl4ai_connector — CrawlForAIMCPConnector
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from podclaw.connectors.crawl4ai_connector import CrawlForAIMCPConnector

FAKE_URL = "http://crawl4ai:11235"


@pytest.fixture()
def connector():
    return CrawlForAIMCPConnector(base_url=FAKE_URL, max_retries=1, max_concurrent=2)


class TestInit:

    def test_empty_url_raises(self):
        with pytest.raises(ValueError, match="CRAWL4AI_URL"):
            CrawlForAIMCPConnector(base_url="")


class TestToolRegistration:

    def test_get_tools_returns_all(self, connector):
        tools = connector.get_tools()
        expected = {"crawl_url", "crawl_batch", "extract_article", "crawl_site", "capture_screenshot"}
        assert set(tools.keys()) == expected


class TestParseResult:

    def test_parse_markdown_string(self):
        result = CrawlForAIMCPConnector._parse_result({
            "url": "https://example.com",
            "markdown": "# Hello",
            "metadata": {"title": "Example"},
            "success": True,
            "status_code": 200,
        })
        assert result["content"] == "# Hello"
        assert result["title"] == "Example"
        assert result["success"] is True

    def test_parse_markdown_dict(self):
        result = CrawlForAIMCPConnector._parse_result({
            "url": "https://example.com",
            "markdown": {"fit_markdown": "# Fit", "raw_markdown": "# Raw"},
            "metadata": {},
            "success": True,
            "status_code": 200,
        })
        assert result["content"] == "# Fit"

    def test_parse_with_links_and_images(self):
        result = CrawlForAIMCPConnector._parse_result({
            "url": "https://example.com",
            "markdown": "",
            "links": {
                "internal": [{"href": "/about"}],
                "external": [{"href": "https://google.com"}],
            },
            "media": {"images": [{"src": "img.png", "alt": "Image"}]},
            "metadata": {},
            "success": True,
            "status_code": 200,
        })
        assert result["links"]["internal"] == ["/about"]
        assert result["links"]["external"] == ["https://google.com"]
        assert result["images"][0]["src"] == "img.png"

    def test_content_capped_at_15000(self):
        result = CrawlForAIMCPConnector._parse_result({
            "url": "https://example.com",
            "markdown": "x" * 20000,
            "metadata": {},
            "success": True,
            "status_code": 200,
        })
        assert len(result["content"]) == 15000


class TestCrawlUrl:

    @respx.mock
    async def test_crawl_url_success(self, connector):
        respx.post(f"{FAKE_URL}/crawl").mock(
            return_value=Response(200, json={
                "results": [{
                    "url": "https://example.com",
                    "markdown": "# Example",
                    "metadata": {"title": "Example"},
                    "success": True,
                    "status_code": 200,
                }]
            })
        )
        result = await connector._crawl_url({"url": "https://example.com"})
        assert result["content"] == "# Example"

    async def test_crawl_url_invalid_url(self, connector):
        result = await connector._crawl_url({"url": "ftp://bad-protocol.com"})
        assert "error" in result

    @respx.mock
    async def test_crawl_url_empty_results(self, connector):
        respx.post(f"{FAKE_URL}/crawl").mock(
            return_value=Response(200, json={"results": []})
        )
        result = await connector._crawl_url({"url": "https://example.com"})
        assert "error" in result


class TestCrawlBatch:

    @respx.mock
    async def test_crawl_batch_success(self, connector):
        respx.post(f"{FAKE_URL}/crawl").mock(
            return_value=Response(200, json={
                "results": [
                    {"url": "https://a.com", "markdown": "A", "metadata": {}, "success": True, "status_code": 200},
                    {"url": "https://b.com", "markdown": "B", "metadata": {}, "success": True, "status_code": 200},
                ]
            })
        )
        result = await connector._crawl_batch({"urls": ["https://a.com", "https://b.com"]})
        assert result["success_count"] == 2
        assert result["total"] == 2

    async def test_crawl_batch_empty(self, connector):
        result = await connector._crawl_batch({"urls": []})
        assert "error" in result

    async def test_crawl_batch_invalid_url(self, connector):
        result = await connector._crawl_batch({"urls": ["ftp://bad.com"]})
        assert "error" in result
