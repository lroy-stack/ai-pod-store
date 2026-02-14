"""
PodClaw — Supabase MCP Connector
===================================

Provides tools for all sub-agents to interact with Supabase:
  supabase_query, supabase_insert, supabase_update, supabase_rpc, supabase_vector_search
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Valid table name pattern (alphanumeric + underscores only)
_TABLE_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class SupabaseMCPConnector:
    """In-process MCP connector for Supabase."""

    def __init__(self, url: str, service_key: str):
        self._url = url.rstrip("/")
        self._key = service_key
        self._headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "supabase_query": {
                "description": "Query rows from a Supabase table with optional filters",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Table name"},
                        "select": {"type": "string", "description": "Columns to select (default: *)"},
                        "filters": {"type": "object", "description": "Column=value equality filters"},
                        "limit": {"type": "integer", "description": "Max rows to return"},
                        "order": {"type": "string", "description": "Column to order by"},
                    },
                    "required": ["table"],
                },
                "handler": self._query,
            },
            "supabase_insert": {
                "description": "Insert one or more rows into a Supabase table",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string"},
                        "data": {"type": ["object", "array"], "description": "Row(s) to insert"},
                    },
                    "required": ["table", "data"],
                },
                "handler": self._insert,
            },
            "supabase_update": {
                "description": "Update rows in a Supabase table matching filters",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string"},
                        "data": {"type": "object", "description": "Fields to update"},
                        "filters": {"type": "object", "description": "Column=value equality filters"},
                    },
                    "required": ["table", "data", "filters"],
                },
                "handler": self._update,
            },
            "supabase_rpc": {
                "description": "Call a Supabase RPC (stored procedure / function)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "function_name": {"type": "string"},
                        "params": {"type": "object", "description": "Function parameters"},
                    },
                    "required": ["function_name"],
                },
                "handler": self._rpc,
            },
            "supabase_vector_search": {
                "description": "Perform vector similarity search using pgvector",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string"},
                        "query_embedding": {"type": "array", "items": {"type": "number"}},
                        "match_count": {"type": "integer", "description": "Number of results"},
                        "match_threshold": {"type": "number", "description": "Similarity threshold (0-1)"},
                    },
                    "required": ["table", "query_embedding"],
                },
                "handler": self._vector_search,
            },
        }

    def _validate_table(self, table: str) -> str:
        """Validate table name to prevent path traversal."""
        if not _TABLE_RE.match(table):
            raise ValueError(f"Invalid table name: {table}")
        return table

    async def _query(self, params: dict[str, Any]) -> dict[str, Any]:
        table = self._validate_table(params["table"])
        select = params.get("select", "*")
        filters = params.get("filters", {})
        limit = params.get("limit", 100)
        order = params.get("order")

        url = f"{self._url}/rest/v1/{table}?select={quote(select)}&limit={limit}"
        for col, val in filters.items():
            url += f"&{quote(col)}=eq.{quote(str(val))}"
        if order:
            url += f"&order={quote(order)}.desc"

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers, timeout=30)
            resp.raise_for_status()
            return {"data": resp.json(), "count": len(resp.json())}

    async def _insert(self, params: dict[str, Any]) -> dict[str, Any]:
        table = self._validate_table(params["table"])
        data = params["data"]

        url = f"{self._url}/rest/v1/{table}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=data, timeout=30)
            resp.raise_for_status()
            return {"data": resp.json(), "status": "inserted"}

    async def _update(self, params: dict[str, Any]) -> dict[str, Any]:
        table = self._validate_table(params["table"])
        data = params["data"]
        filters = params.get("filters", {})

        query_parts = []
        for col, val in filters.items():
            query_parts.append(f"{quote(col)}=eq.{quote(str(val))}")

        url = f"{self._url}/rest/v1/{table}"
        if query_parts:
            url += "?" + "&".join(query_parts)

        async with httpx.AsyncClient() as client:
            resp = await client.patch(url, headers=self._headers, json=data, timeout=30)
            resp.raise_for_status()
            return {"data": resp.json(), "status": "updated"}

    async def _rpc(self, params: dict[str, Any]) -> dict[str, Any]:
        func = params["function_name"]
        if not _TABLE_RE.match(func):
            raise ValueError(f"Invalid function name: {func}")
        rpc_params = params.get("params", {})

        url = f"{self._url}/rest/v1/rpc/{func}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=rpc_params, timeout=30)
            resp.raise_for_status()
            return {"data": resp.json()}

    async def _vector_search(self, params: dict[str, Any]) -> dict[str, Any]:
        func = f"match_{params['table']}"
        rpc_params = {
            "query_embedding": params["query_embedding"],
            "match_count": params.get("match_count", 10),
            "match_threshold": params.get("match_threshold", 0.7),
        }
        return await self._rpc({"function_name": func, "params": rpc_params})
