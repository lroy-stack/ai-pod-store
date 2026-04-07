"""
PodClaw — Printful MCP Connector
===================================

Full CRUD for the cataloger agent via Printful v2 API:
products, files, mockups, orders, shipping, catalog.

Based on:
- Frontend client: frontend/src/lib/pod/printful/client.ts (314 LOC)

Printful API specifics:
- Response envelope: ALL responses are { code, result, paging? } — always unwrap .result
- Rate limit: 120 req/min (token bucket)
- Headers: Bearer auth + X-PF-Store-Id + User-Agent
- Base URL: https://api.printful.com (catalog and store ops)
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import (
    CircuitBreaker,
    RateLimiter,
    retry_with_backoff,
    validate_id,
    validate_url,
    get_supabase_host,
    _err,
)

logger = structlog.get_logger(__name__)

# Base URL for Printful API
PRINTFUL_API = "https://api.printful.com"

# Allowed image hosts for file upload SSRF protection
_ALLOWED_IMAGE_HOSTS = frozenset({
    "images.fal.ai", "fal.media", "v3.fal.media",
    "cdn.ideogram.ai",
    "img.recraft.ai",
    "oaidalleapiprodscus.blob.core.windows.net",
    get_supabase_host(),
    "files.cdn.printful.com",
}) - {""}


# ---------------------------------------------------------------------------
# Printful MCP Connector
# ---------------------------------------------------------------------------

class PrintfulMCPConnector:
    """In-process MCP connector for Printful v2 API."""

    def __init__(self, api_token: str, store_id: str):
        self._token = api_token
        self._store_id = store_id
        self._headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "User-Agent": "PodClaw/1.0",
            "X-PF-Store-Id": store_id,
        }
        self._circuit_breaker = CircuitBreaker(name="printful", failure_threshold=5, timeout=60.0)
        self._rate_limiter = RateLimiter(120)
        # Catalog cache: TTL 10 min
        self._catalog_cache: dict[str, tuple[float, Any]] = {}
        self._catalog_ttl = 600.0  # 10 minutes

    def _new_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        """Fresh client per request. Use as: async with self._new_client() as c:"""
        return httpx.AsyncClient(
            headers=self._headers,
            timeout=timeout,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    async def close(self) -> None:
        pass

    def _cache_get(self, key: str) -> Any | None:
        """Get from catalog cache if not expired."""
        entry = self._catalog_cache.get(key)
        if entry and time.time() < entry[0]:
            return entry[1]
        return None

    def _cache_set(self, key: str, data: Any) -> None:
        """Store in catalog cache with TTL."""
        self._catalog_cache[key] = (time.time() + self._catalog_ttl, data)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        timeout: float = 30.0,
        cache_key: str | None = None,
    ) -> dict[str, Any]:
        """Core request method with rate limiting, retry, cache, and envelope unwrap."""
        # Check cache for GET requests
        if cache_key:
            cached = self._cache_get(cache_key)
            if cached is not None:
                return cached

        await self._rate_limiter.acquire()
        url = f"{PRINTFUL_API}{path}"

        async def request_fn():
            async with self._new_client(timeout=timeout) as client:
                if method == "GET":
                    return await client.get(url)
                elif method == "POST":
                    return await client.post(url, json=json_body)
                elif method == "PUT":
                    return await client.put(url, json=json_body)
                elif method == "DELETE":
                    return await client.delete(url)
                else:
                    raise ValueError(f"Unsupported method: {method}")

        resp = await retry_with_backoff(
            f"{method} {path}",
            request_fn,
            self._circuit_breaker,
        )

        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text[:500]
            return _err(f"{method} {path}: {str(detail)[:300]}", resp.status_code)

        # Printful envelope: { code, result, paging? }
        try:
            data = resp.json()
        except Exception:
            return {"result": resp.text[:500]}

        result = data.get("result", data)
        response = {"result": result}
        if "paging" in data:
            response["paging"] = data["paging"]

        # Cache catalog GETs
        if cache_key:
            self._cache_set(cache_key, response)

        return response

    # ------------------------------------------------------------------
    # Tool definitions
    # ------------------------------------------------------------------

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            # Catalog
            "printful_get_catalog": {
                "description": "List all catalog products from Printful (cached 10 min).",
                "parameters": {"type": "object", "properties": {}},
                "handler": self._get_catalog,
            },
            "printful_get_catalog_product": {
                "description": "Get detailed catalog product info by ID.",
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string", "description": "Catalog product ID"}},
                    "required": ["product_id"],
                },
                "handler": self._get_catalog_product,
            },
            "printful_get_printfiles": {
                "description": "Get printfile specs for a catalog product (dimensions, DPI, positions).",
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string", "description": "Catalog product ID"}},
                    "required": ["product_id"],
                },
                "handler": self._get_printfiles,
            },

            # Store Products
            "printful_list_products": {
                "description": "List sync products in the store. Returns {result: [...], paging: {total, offset, limit}}.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "offset": {"type": "integer", "description": "Pagination offset", "default": 0},
                        "limit": {"type": "integer", "description": "Items per page (max 100)", "default": 100},
                    },
                },
                "handler": self._list_products,
            },
            "printful_get_product": {
                "description": "Get a sync product by ID with variants and print files.",
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string", "description": "Sync product ID"}},
                    "required": ["product_id"],
                },
                "handler": self._get_product,
            },
            "printful_create_product": {
                "description": (
                    "Create a new sync product in Printful. "
                    "Body must include sync_product and sync_variants per Printful docs."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sync_product": {"type": "object", "description": "Product data (name, thumbnail)"},
                        "sync_variants": {"type": "array", "description": "Variant definitions with files"},
                    },
                    "required": ["sync_product", "sync_variants"],
                },
                "handler": self._create_product,
            },
            "printful_update_product": {
                "description": "Update an existing sync product.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string", "description": "Sync product ID to update"},
                        "sync_product": {"type": "object", "description": "Updated product data"},
                        "sync_variants": {"type": "array", "description": "Updated variant definitions"},
                    },
                    "required": ["product_id"],
                },
                "handler": self._update_product,
            },
            "printful_delete_product": {
                "description": "Delete a sync product from Printful.",
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string", "description": "Sync product ID to delete"}},
                    "required": ["product_id"],
                },
                "handler": self._delete_product,
            },

            # Files
            "printful_upload_file": {
                "description": (
                    "Upload a design file to Printful. Accepts url (HTTPS) or base64 content. "
                    "Returns file ID for use in product creation."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "HTTPS URL of the file to upload"},
                        "filename": {"type": "string", "description": "Filename (e.g. 'design.png')"},
                    },
                    "required": ["url"],
                },
                "handler": self._upload_file,
            },
            "printful_get_file": {
                "description": "Get file info by ID.",
                "parameters": {
                    "type": "object",
                    "properties": {"file_id": {"type": "string", "description": "File ID"}},
                    "required": ["file_id"],
                },
                "handler": self._get_file,
            },

            # Mockups
            "printful_create_mockup_task": {
                "description": "Create a mockup generation task for a product.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string", "description": "Sync product ID"},
                        "variant_ids": {"type": "array", "items": {"type": "integer"}, "description": "Variant IDs for mockups"},
                        "files": {"type": "array", "description": "File placements for mockup"},
                    },
                    "required": ["product_id"],
                },
                "handler": self._create_mockup,
            },
            "printful_get_mockup_result": {
                "description": "Get mockup generation task result by task_key.",
                "parameters": {
                    "type": "object",
                    "properties": {"task_key": {"type": "string", "description": "Mockup task key"}},
                    "required": ["task_key"],
                },
                "handler": self._get_mockup_result,
            },

            # Orders
            "printful_create_order": {
                "description": "Create a new order in Printful. Set confirm=true to auto-submit.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "recipient": {"type": "object", "description": "Shipping address"},
                        "items": {"type": "array", "description": "Order items with variant IDs and files"},
                        "confirm": {"type": "boolean", "description": "Auto-confirm order", "default": False},
                    },
                    "required": ["recipient", "items"],
                },
                "handler": self._create_order,
            },
            "printful_get_order": {
                "description": "Get order details by ID.",
                "parameters": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string", "description": "Order ID"}},
                    "required": ["order_id"],
                },
                "handler": self._get_order,
            },
            "printful_cancel_order": {
                "description": "Cancel an order.",
                "parameters": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string", "description": "Order ID to cancel"}},
                    "required": ["order_id"],
                },
                "handler": self._cancel_order,
            },

            # Shipping
            "printful_calculate_shipping": {
                "description": "Calculate shipping rates for an order.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "recipient": {"type": "object", "description": "Shipping address"},
                        "items": {"type": "array", "description": "Items to calculate shipping for"},
                    },
                    "required": ["recipient", "items"],
                },
                "handler": self._calculate_shipping,
            },

            # Webhooks
            "printful_list_webhooks": {
                "description": "List registered webhooks.",
                "parameters": {"type": "object", "properties": {}},
                "handler": self._list_webhooks,
            },
            "printful_setup_webhook": {
                "description": "Register a webhook URL for Printful events.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "Webhook URL (HTTPS)"},
                        "events": {"type": "array", "items": {"type": "string"}, "description": "Event types to subscribe"},
                    },
                    "required": ["url"],
                },
                "handler": self._setup_webhook,
            },
        }

    # ------------------------------------------------------------------
    # Tool handlers — Catalog
    # ------------------------------------------------------------------

    async def _get_catalog(self, params: dict[str, Any]) -> dict[str, Any]:
        return await self._request("GET", "/products", cache_key="catalog_all")

    async def _get_catalog_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")
        return await self._request(
            "GET", f"/products/{product_id}",
            cache_key=f"catalog_{product_id}",
        )

    async def _get_printfiles(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")
        return await self._request(
            "GET", f"/v2/catalog-products/{product_id}/printfiles",
            cache_key=f"printfiles_{product_id}",
        )

    # ------------------------------------------------------------------
    # Tool handlers — Store Products
    # ------------------------------------------------------------------

    async def _list_products(self, params: dict[str, Any]) -> dict[str, Any]:
        offset = max(0, int(params.get("offset", 0)))
        limit = max(1, min(100, int(params.get("limit", 100))))
        return await self._request("GET", f"/store/products?offset={offset}&limit={limit}")

    async def _get_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")
        return await self._request("GET", f"/store/products/{product_id}")

    async def _create_product(self, params: dict[str, Any]) -> dict[str, Any]:
        sync_product = params.get("sync_product")
        sync_variants = params.get("sync_variants")
        if not sync_product or not sync_variants:
            return _err("sync_product and sync_variants required", 400)

        body = {
            "sync_product": sync_product,
            "sync_variants": sync_variants,
        }
        return await self._request("POST", "/store/products", json_body=body, timeout=60.0)

    async def _update_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")

        body = {}
        if "sync_product" in params:
            body["sync_product"] = params["sync_product"]
        if "sync_variants" in params:
            body["sync_variants"] = params["sync_variants"]

        if not body:
            return _err("No update data provided", 400)

        return await self._request("PUT", f"/store/products/{product_id}", json_body=body, timeout=60.0)

    async def _delete_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")
        return await self._request("DELETE", f"/store/products/{product_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Files
    # ------------------------------------------------------------------

    async def _upload_file(self, params: dict[str, Any]) -> dict[str, Any]:
        url = params.get("url", "")
        if url:
            validate_url(url, _ALLOWED_IMAGE_HOSTS)

        body: dict[str, Any] = {"url": url}
        if "filename" in params:
            body["filename"] = params["filename"]

        return await self._request("POST", "/files", json_body=body, timeout=120.0)

    async def _get_file(self, params: dict[str, Any]) -> dict[str, Any]:
        file_id = str(params.get("file_id", ""))
        validate_id(file_id, "file_id")
        return await self._request("GET", f"/files/{file_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Mockups
    # ------------------------------------------------------------------

    async def _create_mockup(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        validate_id(product_id, "product_id")

        body: dict[str, Any] = {}
        if "variant_ids" in params:
            body["variant_ids"] = params["variant_ids"]
        if "files" in params:
            body["files"] = params["files"]

        return await self._request(
            "POST", f"/mockup-generator/create-task/{product_id}",
            json_body=body, timeout=60.0,
        )

    async def _get_mockup_result(self, params: dict[str, Any]) -> dict[str, Any]:
        task_key = params.get("task_key", "")
        if not task_key:
            return _err("task_key required", 400)
        return await self._request("GET", f"/mockup-generator/task?task_key={task_key}")

    # ------------------------------------------------------------------
    # Tool handlers — Orders
    # ------------------------------------------------------------------

    async def _create_order(self, params: dict[str, Any]) -> dict[str, Any]:
        recipient = params.get("recipient")
        items = params.get("items")
        confirm = params.get("confirm", False)

        if not recipient or not items:
            return _err("recipient and items required", 400)

        body = {"recipient": recipient, "items": items}
        qs = "?confirm=true" if confirm else ""

        return await self._request("POST", f"/orders{qs}", json_body=body, timeout=60.0)

    async def _get_order(self, params: dict[str, Any]) -> dict[str, Any]:
        order_id = str(params.get("order_id", ""))
        validate_id(order_id, "order_id")
        return await self._request("GET", f"/orders/{order_id}")

    async def _cancel_order(self, params: dict[str, Any]) -> dict[str, Any]:
        order_id = str(params.get("order_id", ""))
        validate_id(order_id, "order_id")
        return await self._request("DELETE", f"/orders/{order_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Shipping
    # ------------------------------------------------------------------

    async def _calculate_shipping(self, params: dict[str, Any]) -> dict[str, Any]:
        recipient = params.get("recipient")
        items = params.get("items")
        if not recipient or not items:
            return _err("recipient and items required", 400)

        body = {"recipient": recipient, "items": items}
        return await self._request("POST", "/shipping/rates", json_body=body)

    # ------------------------------------------------------------------
    # Tool handlers — Webhooks
    # ------------------------------------------------------------------

    async def _list_webhooks(self, params: dict[str, Any]) -> dict[str, Any]:
        return await self._request("GET", "/webhooks")

    async def _setup_webhook(self, params: dict[str, Any]) -> dict[str, Any]:
        url = params.get("url", "")
        if not url:
            return _err("url required", 400)

        # Default Printful events to subscribe
        events = params.get("events", [
            "package_shipped", "package_returned",
            "order_created", "order_updated", "order_failed",
            "order_canceled", "order_put_hold", "order_remove_hold",
            "product_synced", "product_updated", "product_deleted",
            "stock_updated",
        ])

        body = {"url": url, "types": events}
        return await self._request("POST", "/webhooks", json_body=body)
