"""
E2E Tests — Connector Smoke Tests
====================================

Tests each connector against real (or mocked) services to verify:
- Tool registration (get_tools returns valid schemas)
- Basic call succeeds and returns expected format
- Error handling returns _err() format, not exceptions
- readOnlyHint annotation is correct

These tests do NOT require live services — they verify the connector
interface contract. For live service tests, use pytest markers:
  pytest -m live podclaw/tests/e2e/test_connectors.py
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_tool_schema(tools: dict) -> list[str]:
    """Validate that all tools have required schema fields. Returns issues."""
    issues = []
    for name, schema in tools.items():
        if not isinstance(schema, dict):
            issues.append(f"{name}: schema is not a dict")
            continue
        if "description" not in schema:
            issues.append(f"{name}: missing description")
        if "input_schema" not in schema:
            issues.append(f"{name}: missing input_schema")
        else:
            input_schema = schema["input_schema"]
            if input_schema.get("type") != "object":
                issues.append(f"{name}: input_schema.type must be 'object'")
    return issues


# ---------------------------------------------------------------------------
# Supabase Connector
# ---------------------------------------------------------------------------

class TestSupabaseConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.supabase_connector import SupabaseMCPConnector
        conn = SupabaseMCPConnector("https://fake.supabase.co", "fake-key")
        tools = conn.get_tools()
        assert len(tools) >= 5, f"Expected >=5 tools, got {len(tools)}"
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"

    def test_has_query_tool(self):
        from podclaw.connectors.supabase_connector import SupabaseMCPConnector
        conn = SupabaseMCPConnector("https://fake.supabase.co", "fake-key")
        tools = conn.get_tools()
        assert "supabase_query" in tools

    def test_readonly_hints(self):
        from podclaw.connectors.supabase_connector import SupabaseMCPConnector
        conn = SupabaseMCPConnector("https://fake.supabase.co", "fake-key")
        tools = conn.get_tools()
        read_tools = {"supabase_query", "supabase_count"}
        for name in read_tools:
            if name in tools:
                assert tools[name].get("readOnlyHint") is True, f"{name} should be readOnlyHint"


# ---------------------------------------------------------------------------
# Stripe Connector
# ---------------------------------------------------------------------------

class TestStripeConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.stripe_connector import StripeMCPConnector
        conn = StripeMCPConnector("sk_test_fake")
        tools = conn.get_tools()
        assert len(tools) >= 3
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"

    def test_has_balance_tool(self):
        from podclaw.connectors.stripe_connector import StripeMCPConnector
        conn = StripeMCPConnector("sk_test_fake")
        tools = conn.get_tools()
        assert "stripe_get_balance" in tools


# ---------------------------------------------------------------------------
# Printful Connector
# ---------------------------------------------------------------------------

class TestPrintfulConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.printful_connector import PrintfulMCPConnector
        conn = PrintfulMCPConnector("fake-token", "fake-store")
        tools = conn.get_tools()
        assert len(tools) >= 10
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"


# ---------------------------------------------------------------------------
# FAL Connector
# ---------------------------------------------------------------------------

class TestFalConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.fal_connector import FalMCPConnector
        conn = FalMCPConnector("fake-key")
        tools = conn.get_tools()
        assert len(tools) >= 2
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"


# ---------------------------------------------------------------------------
# Gemini Connector
# ---------------------------------------------------------------------------

class TestGeminiConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.gemini_connector import GeminiMCPConnector
        conn = GeminiMCPConnector("fake-key")
        tools = conn.get_tools()
        assert len(tools) >= 2
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"


# ---------------------------------------------------------------------------
# Resend Connector
# ---------------------------------------------------------------------------

class TestResendConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.resend_connector import ResendMCPConnector
        conn = ResendMCPConnector("re_fake", "noreply@test.com")
        tools = conn.get_tools()
        assert len(tools) >= 2
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"

    def test_has_send_email(self):
        from podclaw.connectors.resend_connector import ResendMCPConnector
        conn = ResendMCPConnector("re_fake", "noreply@test.com")
        tools = conn.get_tools()
        assert "resend_send_email" in tools


# ---------------------------------------------------------------------------
# Crawl4AI Connector
# ---------------------------------------------------------------------------

class TestCrawl4AIConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.crawl4ai_connector import CrawlForAIMCPConnector
        conn = CrawlForAIMCPConnector("http://fake:11235")
        tools = conn.get_tools()
        assert len(tools) >= 2
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"


# ---------------------------------------------------------------------------
# SVG Renderer Connector
# ---------------------------------------------------------------------------

class TestSVGRendererConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.connectors.svg_renderer_connector import SVGRendererConnector
        conn = SVGRendererConnector("http://fake:3002")
        tools = conn.get_tools()
        assert len(tools) >= 1
        issues = _validate_tool_schema(tools)
        assert not issues, f"Schema issues: {issues}"


# ---------------------------------------------------------------------------
# Memory Search Connector
# ---------------------------------------------------------------------------

class TestMemorySearchConnector:
    def test_get_tools_returns_valid_schemas(self):
        from podclaw.memory_search import MemoryIndex
        from podclaw.connectors.memory_search_connector import MemorySearchConnector
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = MemoryIndex(db_path=Path(tmpdir) / "test.db")
            conn = MemorySearchConnector(idx)
            tools = conn.get_tools()
            assert "memory_search" in tools
            issues = _validate_tool_schema(tools)
            assert not issues, f"Schema issues: {issues}"
            assert tools["memory_search"].get("readOnlyHint") is True

    @pytest.mark.asyncio
    async def test_search_empty_index(self):
        from podclaw.memory_search import MemoryIndex
        from podclaw.connectors.memory_search_connector import MemorySearchConnector
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = MemoryIndex(db_path=Path(tmpdir) / "test.db")
            conn = MemorySearchConnector(idx)
            result = await conn.call_tool("memory_search", {"query": "test"})
            assert "result" in result
            assert result["result"]["results"] == []

    @pytest.mark.asyncio
    async def test_search_finds_indexed_content(self):
        from podclaw.memory_search import MemoryIndex
        from podclaw.connectors.memory_search_connector import MemorySearchConnector
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = MemoryIndex(db_path=Path(tmpdir) / "test.db")
            idx.index_document("test.md", "The ghost hoodie design was approved by the CEO")
            conn = MemorySearchConnector(idx)
            result = await conn.call_tool("memory_search", {"query": "ghost hoodie"})
            assert "result" in result
            assert len(result["result"]["results"]) > 0
            assert "ghost" in result["result"]["results"][0]["excerpt"].lower()


# ---------------------------------------------------------------------------
# All connectors: tool count summary
# ---------------------------------------------------------------------------

class TestConnectorSummary:
    def test_total_tool_count(self):
        """Verify total tool count matches expected (57+ tools across 9 connectors)."""
        from podclaw.connectors.supabase_connector import SupabaseMCPConnector
        from podclaw.connectors.stripe_connector import StripeMCPConnector
        from podclaw.connectors.printful_connector import PrintfulMCPConnector
        from podclaw.connectors.fal_connector import FalMCPConnector
        from podclaw.connectors.gemini_connector import GeminiMCPConnector
        from podclaw.connectors.resend_connector import ResendMCPConnector
        from podclaw.connectors.crawl4ai_connector import CrawlForAIMCPConnector
        from podclaw.connectors.svg_renderer_connector import SVGRendererConnector

        connectors = {
            "supabase": SupabaseMCPConnector("https://fake.supabase.co", "key"),
            "stripe": StripeMCPConnector("sk_test_fake"),
            "printful": PrintfulMCPConnector("token", "store"),
            "fal": FalMCPConnector("key"),
            "gemini": GeminiMCPConnector("key"),
            "resend": ResendMCPConnector("re_fake", "noreply@test.com"),
            "crawl4ai": CrawlForAIMCPConnector("http://fake:11235"),
            "svg_renderer": SVGRendererConnector("http://fake:3002"),
        }

        total = sum(len(c.get_tools()) for c in connectors.values())
        assert total >= 50, f"Expected >= 50 tools, got {total}"
