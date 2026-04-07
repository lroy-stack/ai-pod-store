"""
PodClaw — Supabase MCP Connector
===================================

8 tools for all sub-agents to interact with Supabase:
  supabase_query, supabase_insert, supabase_update, supabase_delete,
  supabase_rpc, supabase_vector_search, supabase_upload_image, supabase_count
"""

from __future__ import annotations

import base64
import re
import uuid
from typing import Any
from urllib.parse import quote

import httpx
import structlog

from podclaw.connectors._shared import CircuitBreaker, _err

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
        self._circuit_breaker = CircuitBreaker(name="supabase", failure_threshold=5, timeout=60.0)

    def _new_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        """Create a fresh httpx client. Use as context manager: async with self._new_client() as c:"""
        return httpx.AsyncClient(
            headers=self._headers,
            timeout=timeout,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    async def close(self) -> None:
        pass  # No persistent client to close

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "supabase_query": {
                "description": (
                    "Query rows from a Supabase table. Returns {data: [...rows], count: N}. "
                    "Filters are equality-only (column=value). Order defaults to descending. "
                    "Key tables: products (id, title, description, category, base_price_cents, cost_cents, "
                    "currency, status, printful_id, images JSONB, published_at), "
                    "product_variants (id, product_id, size, color, price_cents, cost_cents), "
                    "designs (id, prompt, style, image_url, moderation_status, product_id)."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Table name (e.g. 'products', 'designs', 'orders')"},
                        "select": {"type": "string", "description": "Columns to select (default: *). e.g. 'id,title,base_price_cents'"},
                        "filters": {"type": "object", "description": "Equality filters: {column: value}. e.g. {status: 'active'}"},
                        "limit": {"type": "integer", "description": "Max rows (default: 100)"},
                        "order": {"type": "string", "description": "Column to order by (descending). e.g. 'created_at'"},
                    },
                    "required": ["table"],
                },
                "handler": self._query,
            },
            "supabase_insert": {
                "description": (
                    "Insert one or more rows. Returns {data: [inserted_rows], status: 'inserted'}. "
                    "For products table, required/common fields: title (str), description (str or JSON), "
                    "category (str), base_price_cents (int, EUR cents), cost_cents (int, EUR cents), "
                    "currency ('EUR'), status ('draft'|'active'|'archived'|'deleted'|'publishing'), "
                    "printful_id (str), images (JSONB array: [{src: url, alt: text}]). "
                    "UUID primary keys are auto-generated."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string"},
                        "data": {
                            "type": ["object", "array"],
                            "description": "Row object or array of rows to insert",
                        },
                    },
                    "required": ["table", "data"],
                },
                "handler": self._insert,
            },
            "supabase_update": {
                "description": (
                    "Update rows matching equality filters. Returns {data: [updated_rows], status: 'updated'}. "
                    "Only include fields you want to change in 'data'. "
                    "Filters are equality-only: {printful_id: 'abc123'} or {id: 'uuid'}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string"},
                        "data": {"type": "object", "description": "Fields to update with new values"},
                        "filters": {"type": "object", "description": "Equality filters to match rows: {column: value}"},
                    },
                    "required": ["table", "data", "filters"],
                },
                "handler": self._update,
            },
            "supabase_delete": {
                "description": (
                    "Delete rows from a Supabase table matching equality filters. "
                    "Returns {deleted: [...rows], count: N}. "
                    "Filters are REQUIRED — unfiltered deletes are blocked. "
                    "Protected tables (users, orders, payments, etc.) are blocked by security hook."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Table name (e.g. 'products', 'designs')"},
                        "filters": {
                            "type": "object",
                            "description": "Equality filters to match rows for deletion: {column: value}. REQUIRED.",
                        },
                    },
                    "required": ["table", "filters"],
                },
                "handler": self._delete,
            },
            "supabase_rpc": {
                "description": (
                    "Call a Supabase stored procedure. Returns {data: <result>}. "
                    "Allowed functions: match_products, match_product_embeddings, match_designs, "
                    "get_category_distribution, get_product_stats, get_daily_revenue, "
                    "get_rfm_segments, increment_usage."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "function_name": {"type": "string", "description": "RPC function name (must be in approved list)"},
                        "params": {"type": "object", "description": "Function parameters as key-value pairs"},
                    },
                    "required": ["function_name"],
                },
                "handler": self._rpc,
            },
            "supabase_vector_search": {
                "description": (
                    "Semantic similarity search via pgvector. Calls match_{table}(query_embedding, count, threshold). "
                    "Returns {data: [{id, title, similarity, ...}]}. Threshold 0-1 (higher = more similar, default 0.7). "
                    "Requires a 768-dim embedding from gemini_embed_text."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Table name (e.g. 'products', 'designs')"},
                        "query_embedding": {"type": "array", "items": {"type": "number"}, "description": "768-dim float array from Gemini"},
                        "match_count": {"type": "integer", "description": "Number of results (default: 10)"},
                        "match_threshold": {"type": "number", "description": "Similarity threshold 0-1 (default: 0.7)"},
                    },
                    "required": ["table", "query_embedding"],
                },
                "handler": self._vector_search,
            },
            "supabase_upload_image": {
                "description": (
                    "Upload an image to Supabase Storage. Accepts either a public URL (downloads first) "
                    "or base64 data (from gemini_generate_image). Returns the public URL. "
                    "The response includes `already_transparent: true/false` — if true, the image "
                    "already has a transparent background and fal_remove_background is NOT needed. "
                    "Default bucket: 'designs'. Max 5MB."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_name": {
                            "type": "string",
                            "description": "Filename with extension (e.g. 'design-sunset-001.png')",
                        },
                        "image_url": {
                            "type": "string",
                            "description": "Public URL to download and store (use this OR image_base64)",
                        },
                        "image_base64": {
                            "type": "string",
                            "description": "Base64-encoded image data (use this OR image_url)",
                        },
                        "mime_type": {
                            "type": "string",
                            "description": "MIME type (default: image/png)",
                        },
                        "bucket": {
                            "type": "string",
                            "description": "Storage bucket name (default: 'designs')",
                        },
                    },
                    "required": ["file_name"],
                },
                "handler": self._upload_image,
            },
            "supabase_count": {
                "description": (
                    "Count rows in a table matching optional equality filters. "
                    "Lightweight alternative to supabase_query when you only need the count. "
                    "Returns {count: N}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table": {"type": "string", "description": "Table name"},
                        "filters": {"type": "object", "description": "Equality filters: {column: value}"},
                    },
                    "required": ["table"],
                },
                "handler": self._count,
            },
        }

    def _validate_table(self, table: str) -> str:
        """Validate table name to prevent path traversal."""
        if not _TABLE_RE.match(table):
            raise ValueError(f"Invalid table name: {table}")
        return table

    async def _query(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open — too many recent failures")
        table = self._validate_table(params["table"])
        select = params.get("select", "*")
        filters = params.get("filters", {})
        limit = params.get("limit", 100)
        order = params.get("order")

        url = f"{self._url}/rest/v1/{table}?select={quote(select)}&limit={limit}"
        for col, val in filters.items():
            url += f"&{col}=eq.{quote(str(val))}"
        if order:
            url += f"&order={order}.desc"

        try:
            async with self._new_client() as client:
                resp = await client.get(url)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                data = resp.json()
                return {"data": data, "count": len(data)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Query failed: {e}")

    async def _insert(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open")
        table = self._validate_table(params["table"])
        data = params["data"]

        url = f"{self._url}/rest/v1/{table}"
        try:
            async with self._new_client() as client:
                resp = await client.post(url, json=data)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                return {"data": resp.json(), "status": "inserted"}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Insert failed: {e}")

    async def _update(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open")
        table = self._validate_table(params["table"])
        data = params["data"]
        filters = params.get("filters", {})

        if not filters:
            return _err("Filters are required for update — unfiltered updates are blocked")

        query_parts = [f"{col}=eq.{quote(str(val))}" for col, val in filters.items()]
        url = f"{self._url}/rest/v1/{table}?" + "&".join(query_parts)

        try:
            async with self._new_client() as client:
                resp = await client.patch(url, json=data)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                return {"data": resp.json(), "status": "updated"}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Update failed: {e}")

    async def _delete(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open")
        table = self._validate_table(params["table"])
        filters = params.get("filters", {})

        if not filters:
            return _err("Filters are required for delete — unfiltered deletes are blocked")

        query_parts = [f"{col}=eq.{quote(str(val))}" for col, val in filters.items()]
        url = f"{self._url}/rest/v1/{table}?" + "&".join(query_parts)

        try:
            async with self._new_client() as client:
                resp = await client.delete(url)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                deleted = resp.json() if resp.text else []
                logger.info("supabase_rows_deleted", table=table, count=len(deleted))
                return {"deleted": deleted, "count": len(deleted)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Delete failed: {e}")

    async def _rpc(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open")
        func = params["function_name"]
        if not _TABLE_RE.match(func):
            return _err(f"Invalid function name: {func}")
        rpc_params = params.get("params", {})

        url = f"{self._url}/rest/v1/rpc/{func}"
        try:
            async with self._new_client() as client:
                resp = await client.post(url, json=rpc_params)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                return {"data": resp.json()}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"RPC failed: {e}")

    async def _vector_search(self, params: dict[str, Any]) -> dict[str, Any]:
        func = f"match_{params['table']}"
        rpc_params = {
            "query_embedding": params["query_embedding"],
            "match_count": params.get("match_count", 10),
            "match_threshold": params.get("match_threshold", 0.7),
        }
        return await self._rpc({"function_name": func, "params": rpc_params})

    async def _upload_image(self, params: dict[str, Any]) -> dict[str, Any]:
        file_name = params["file_name"]
        bucket = params.get("bucket", "designs")
        mime_type = params.get("mime_type", "image/png")

        # Get image bytes from URL or base64
        if params.get("image_base64"):
            image_bytes = base64.b64decode(params["image_base64"])
        elif params.get("image_url"):
            try:
                async with httpx.AsyncClient(timeout=30) as dl_client:
                    resp = await dl_client.get(params["image_url"])
                    resp.raise_for_status()
                    image_bytes = resp.content
                    ct = resp.headers.get("content-type", "")
                    if ct and ct.startswith("image/"):
                        mime_type = ct.split(";")[0]
            except Exception as e:
                return _err(f"Failed to download image: {e}")
        else:
            return _err("Either image_url or image_base64 is required")

        # Validate size (5MB max)
        if len(image_bytes) > 5 * 1024 * 1024:
            return _err(f"Image too large: {len(image_bytes)} bytes (max 5MB)")

        # Add unique suffix to prevent overwrites
        name_parts = file_name.rsplit(".", 1)
        if len(name_parts) == 2:
            unique_name = f"{name_parts[0]}-{uuid.uuid4().hex[:8]}.{name_parts[1]}"
        else:
            unique_name = f"{file_name}-{uuid.uuid4().hex[:8]}"

        # Upload to Supabase Storage
        upload_url = f"{self._url}/storage/v1/object/{bucket}/{unique_name}"
        upload_headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": mime_type,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as ul_client:
                resp = await ul_client.post(upload_url, headers=upload_headers, content=image_bytes)
                if resp.status_code >= 400:
                    detail = resp.text[:500]
                    logger.error("supabase_upload_failed", status=resp.status_code, detail=detail)
                    return _err(f"Upload failed ({resp.status_code}): {detail}")
        except Exception as e:
            return _err(f"Upload failed: {e}")

        public_url = f"{self._url}/storage/v1/object/public/{bucket}/{unique_name}"

        # Detect if image already has transparent background
        already_transparent = False
        try:
            from podclaw.bg_removal import has_transparency
            already_transparent = has_transparency(image_bytes)
        except Exception:
            pass

        logger.info("supabase_image_uploaded", url=public_url[:100], size=len(image_bytes),
                     transparent=already_transparent)

        return {
            "url": public_url,
            "bucket": bucket,
            "file_name": unique_name,
            "size_bytes": len(image_bytes),
            "already_transparent": already_transparent,
        }

    async def _count(self, params: dict[str, Any]) -> dict[str, Any]:
        """Count rows matching filters using PostgREST exact count."""
        if not self._circuit_breaker.can_attempt():
            return _err("Supabase circuit breaker open")
        table = self._validate_table(params["table"])
        filters = params.get("filters", {})

        url = f"{self._url}/rest/v1/{table}?select=count"
        for col, val in filters.items():
            url += f"&{col}=eq.{quote(str(val))}"

        count_headers = {**self._headers, "Prefer": "count=exact"}

        try:
            async with self._new_client() as client:
                resp = await client.head(url, headers=count_headers)
                resp.raise_for_status()
                self._circuit_breaker.record_success()

                content_range = resp.headers.get("content-range", "")
                if "/" in content_range:
                    total = content_range.split("/")[-1]
                    count = int(total) if total != "*" else 0
                else:
                    count = 0

                return {"count": count}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Count failed: {e}")
