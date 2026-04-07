# Copyright (c) 2026 L.LOWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Memory Search MCP Connector
=========================================

Single tool: memory_search — full-text search over PodClaw's memory files
(MEMORY.md, daily logs, context, weekly summaries).

Uses FTS5 with BM25 ranking. Returns top-K results with excerpts and sources.
"""

from __future__ import annotations

from typing import Any

import structlog

from podclaw.connectors._shared import _ok, _err

logger = structlog.get_logger(__name__)


class MemorySearchConnector:
    """MCP connector for cognitive memory search."""

    def __init__(self, memory_index: Any):
        self._index = memory_index

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "memory_search": {
                "description": (
                    "Search PodClaw's long-term memory, daily logs, and context files. "
                    "Use this to find past decisions, product history, CEO preferences, "
                    "or any information stored in memory. Returns ranked excerpts with sources."
                ),
                "input_schema": {
                    "type": "object",
                    "required": ["query"],
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (keywords or natural language)",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results to return (default 5, max 20)",
                            "default": 5,
                        },
                    },
                },
                "handler": self._handle_search,
                "readOnlyHint": True,
            },
        }

    async def _handle_search(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handler for memory_search tool (called by connector_adapter)."""
        query = arguments.get("query", "")
        limit = min(arguments.get("limit", 5), 20)

        if not query or not query.strip():
            return _err("Query cannot be empty")

        try:
            results = self._index.search(query, limit=limit)

            if not results:
                return _ok({
                    "results": [],
                    "message": f"No results found for: {query}",
                })

            return _ok({
                "results": [r.to_dict() for r in results],
                "query": query,
                "count": len(results),
            })
        except Exception as e:
            logger.error("memory_search_failed", query=query[:50], error=str(e))
            return _err(f"Search failed: {str(e)[:200]}")
