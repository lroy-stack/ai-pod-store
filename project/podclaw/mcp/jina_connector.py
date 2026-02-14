"""
PodClaw — Jina MCP Connector
================================

Reranking via Jina Reranker v2 (free, open source).
Used for RAG result reranking in Phase 2.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

JINA_API = "https://api.jina.ai/v1"


class JinaMCPConnector:
    """In-process MCP connector for Jina reranking."""

    def __init__(self, api_key: str):
        self._key = api_key
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "jina_rerank": {
                "description": "Rerank search results using Jina Reranker v2",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search query"},
                        "documents": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Documents to rerank",
                        },
                        "top_n": {"type": "integer", "description": "Number of top results to return"},
                    },
                    "required": ["query", "documents"],
                },
                "handler": self._rerank,
            },
        }

    async def _rerank(self, params: dict[str, Any]) -> dict[str, Any]:
        body = {
            "model": "jina-reranker-v2-base-multilingual",
            "query": params["query"],
            "documents": params["documents"],
        }
        if params.get("top_n"):
            body["top_n"] = params["top_n"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{JINA_API}/rerank", headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()
