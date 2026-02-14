"""
PodClaw — Web Search MCP Connector
=====================================

Web search for researcher, seo_manager, and marketing agents.
Uses Jina Search API (s.jina.ai) for real web search results.
Falls back to empty results if no API key is configured.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

JINA_SEARCH_URL = "https://s.jina.ai"


class WebSearchMCPConnector:
    """In-process MCP connector for web search via Jina."""

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.getenv("JINA_API_KEY", "")

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "web_search": {
                "description": "Search the web for information. Returns relevant results with titles, URLs, and snippets.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "max_results": {"type": "integer", "description": "Max results (default 5)"},
                        "site": {"type": "string", "description": "Limit to specific site (e.g., 'etsy.com')"},
                    },
                    "required": ["query"],
                },
                "handler": self._search,
            },
        }

    async def _search(self, params: dict[str, Any]) -> dict[str, Any]:
        query = params["query"]
        max_results = params.get("max_results", 5)
        site = params.get("site")

        if site:
            query = f"site:{site} {query}"

        if not self._api_key:
            logger.warning("web_search_no_api_key", query=query)
            return {
                "query": query,
                "results": [],
                "error": "JINA_API_KEY not configured — web search unavailable",
            }

        try:
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "application/json",
            }
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{JINA_SEARCH_URL}/{query}",
                    headers=headers,
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()

                results = data.get("data", [])[:max_results]
                logger.info("web_search_ok", query=query, result_count=len(results))

                return {
                    "query": query,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "description": r.get("description", r.get("content", ""))[:500],
                        }
                        for r in results
                    ],
                }
        except httpx.HTTPStatusError as e:
            logger.error("web_search_http_error", query=query, status=e.response.status_code)
            return {"query": query, "results": [], "error": f"HTTP {e.response.status_code}"}
        except Exception as e:
            logger.error("web_search_error", query=query, error=str(e))
            return {"query": query, "results": [], "error": str(e)}
