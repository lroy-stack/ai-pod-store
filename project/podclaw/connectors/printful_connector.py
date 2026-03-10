"""
PodClaw — Printful MCP Connector
===================================

Full CRUD for the cataloger agent via Printful v2 API:
products, files, mockups, orders, shipping, catalog.

Based on:
- Frontend client: frontend/src/lib/pod/printful/client.ts (314 LOC)
- Printify connector patterns: SSRF, circuit breaker, retry, get_tools()

Printful API key differences from Printify:
- Response envelope: ALL responses are { code, result, paging? } — always unwrap .result
- Rate limit: 120 req/min (token bucket)
- Headers: Bearer auth + X-PF-Store-Id + User-Agent
- Base URL: https://api.printful.com (catalog and store ops)
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import time
from typing import Any
from urllib.parse import urlparse

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Base URL for Printful API
PRINTFUL_API = "https://api.printful.com"

# Safe ID pattern: alphanumeric, hyphens, underscores only
_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9\-_]+$")

# Allowed image hosts (extend Printify's list with Printful CDN)
_ALLOWED_IMAGE_HOSTS = frozenset({
    "images.fal.ai", "fal.media", "v3.fal.media",
    "cdn.ideogram.ai",
    "img.recraft.ai",
    "oaidalleapiprodscus.blob.core.windows.net",
    "your-project.supabase.co",
    "files.cdn.printful.com",
})

# Rate limit: 120 requests per minute
_RATE_LIMIT_PER_MIN = 120
_RATE_LIMIT_WINDOW = 60.0  # seconds


# ---------------------------------------------------------------------------
# Shared utilities (from printify_connector.py)
# ---------------------------------------------------------------------------

def _validate_id(value: str, field_name: str) -> None:
    """Validate that an ID parameter is safe for URL interpolation."""
    if not value or not _SAFE_ID_RE.match(str(value)):
        raise ValueError(f"Invalid {field_name}: must be alphanumeric (got '{value[:50]}')")


def _resolve_and_check_ssrf(hostname: str) -> None:
    """Resolve hostname to IP and block private/reserved addresses (SSRF protection)."""
    try:
        infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for '{hostname}': {e}")

    for info in infos:
        ip_str = info[4][0]
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError(
                f"SSRF blocked: '{hostname}' resolves to private/reserved IP {ip_str}"
            )


def _validate_image_url(url: str) -> None:
    """Validate that the image URL is HTTPS and from an allowed host."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS URLs allowed, got: {parsed.scheme}")
    if parsed.hostname and parsed.hostname not in _ALLOWED_IMAGE_HOSTS:
        raise ValueError(f"Image host not allowed: {parsed.hostname}")
    if parsed.hostname:
        _resolve_and_check_ssrf(parsed.hostname)


def _format_error(tool_name: str, status: int, detail: str) -> dict[str, Any]:
    """Standardized error response for API failures."""
    return {
        "error": True,
        "tool": tool_name,
        "status": status,
        "message": detail[:500],
    }


class CircuitBreaker:
    """Circuit breaker to prevent cascading failures.

    Opens circuit after 5 consecutive failures, stays open for 60s.
    """

    def __init__(self, failure_threshold: int = 5, timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time: float | None = None
        self.state = "closed"  # closed, open, half-open

    def record_success(self) -> None:
        self.failure_count = 0
        if self.state == "half-open":
            self.state = "closed"
            logger.info("circuit_breaker_closed", provider="printful")

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold and self.state == "closed":
            self.state = "open"
            logger.warning("circuit_breaker_opened", provider="printful", count=self.failure_count)

    def can_attempt(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if self.last_failure_time and (time.time() - self.last_failure_time) >= self.timeout:
                self.state = "half-open"
                return True
            return False
        return True  # half-open


async def _retry_with_backoff(
    operation: str,
    request_fn: Any,
    circuit_breaker: CircuitBreaker,
    max_attempts: int = 3,
) -> httpx.Response:
    """Retry HTTP requests with exponential backoff for 429/5xx errors."""
    backoff_delays = [2.0, 4.0, 8.0]
    resp = None

    for attempt in range(max_attempts):
        if not circuit_breaker.can_attempt():
            raise httpx.HTTPStatusError(
                "Circuit breaker is open — too many consecutive failures",
                request=None,  # type: ignore
                response=None,  # type: ignore
            )

        try:
            resp = await request_fn()

            if resp.status_code < 400:
                circuit_breaker.record_success()
                return resp

            if resp.status_code == 429 and attempt < max_attempts - 1:
                retry_after = resp.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else backoff_delays[attempt]
                logger.warning("printful_rate_limited", op=operation, attempt=attempt + 1, delay=delay)
                await asyncio.sleep(delay)
                continue

            if resp.status_code >= 500 and attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning("printful_server_error", op=operation, status=resp.status_code, delay=delay)
                circuit_breaker.record_failure()
                await asyncio.sleep(delay)
                continue

            if resp.status_code >= 400:
                circuit_breaker.record_failure()
                return resp

        except (httpx.RequestError, httpx.TimeoutException) as exc:
            circuit_breaker.record_failure()
            if attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning("printful_network_error", op=operation, error=str(exc)[:200], delay=delay)
                await asyncio.sleep(delay)
                continue
            raise

    circuit_breaker.record_failure()
    return resp  # type: ignore


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
        self._client: httpx.AsyncClient | None = None
        self._circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60.0)
        # Rate limiting: token bucket
        self._rate_count = 0
        self._rate_window_start = time.time()
        # Catalog cache: TTL 10 min
        self._catalog_cache: dict[str, tuple[float, Any]] = {}
        self._catalog_ttl = 600.0  # 10 minutes

    async def _get_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers=self._headers,
                timeout=timeout,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        else:
            self._client.timeout = httpx.Timeout(timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _enforce_rate_limit(self) -> None:
        """Token bucket rate limiter: 120 req/min."""
        now = time.time()
        if now - self._rate_window_start > _RATE_LIMIT_WINDOW:
            self._rate_count = 0
            self._rate_window_start = now
        self._rate_count += 1
        if self._rate_count > _RATE_LIMIT_PER_MIN:
            wait = _RATE_LIMIT_WINDOW - (now - self._rate_window_start) + 0.1
            logger.debug("printful_rate_limit_wait", wait=round(wait, 1))
            await asyncio.sleep(wait)
            self._rate_count = 0
            self._rate_window_start = time.time()

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

        await self._enforce_rate_limit()
        client = await self._get_client(timeout=timeout)
        url = f"{PRINTFUL_API}{path}"

        async def request_fn():
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

        resp = await _retry_with_backoff(
            f"{method} {path}",
            request_fn,
            self._circuit_breaker,
        )

        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text[:500]
            return _format_error(f"{method} {path}", resp.status_code, str(detail))

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
            "printful_create_mockup": {
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
        _validate_id(product_id, "product_id")
        return await self._request(
            "GET", f"/products/{product_id}",
            cache_key=f"catalog_{product_id}",
        )

    async def _get_printfiles(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        _validate_id(product_id, "product_id")
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
        _validate_id(product_id, "product_id")
        return await self._request("GET", f"/store/products/{product_id}")

    async def _create_product(self, params: dict[str, Any]) -> dict[str, Any]:
        sync_product = params.get("sync_product")
        sync_variants = params.get("sync_variants")
        if not sync_product or not sync_variants:
            return _format_error("printful_create_product", 400, "sync_product and sync_variants required")

        body = {
            "sync_product": sync_product,
            "sync_variants": sync_variants,
        }
        return await self._request("POST", "/store/products", json_body=body, timeout=60.0)

    async def _update_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        _validate_id(product_id, "product_id")

        body = {}
        if "sync_product" in params:
            body["sync_product"] = params["sync_product"]
        if "sync_variants" in params:
            body["sync_variants"] = params["sync_variants"]

        if not body:
            return _format_error("printful_update_product", 400, "No update data provided")

        return await self._request("PUT", f"/store/products/{product_id}", json_body=body, timeout=60.0)

    async def _delete_product(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        _validate_id(product_id, "product_id")
        return await self._request("DELETE", f"/store/products/{product_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Files
    # ------------------------------------------------------------------

    async def _upload_file(self, params: dict[str, Any]) -> dict[str, Any]:
        url = params.get("url", "")
        if url:
            _validate_image_url(url)

        body: dict[str, Any] = {"url": url}
        if "filename" in params:
            body["filename"] = params["filename"]

        return await self._request("POST", "/files", json_body=body, timeout=120.0)

    async def _get_file(self, params: dict[str, Any]) -> dict[str, Any]:
        file_id = str(params.get("file_id", ""))
        _validate_id(file_id, "file_id")
        return await self._request("GET", f"/files/{file_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Mockups
    # ------------------------------------------------------------------

    async def _create_mockup(self, params: dict[str, Any]) -> dict[str, Any]:
        product_id = str(params.get("product_id", ""))
        _validate_id(product_id, "product_id")

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
            return _format_error("printful_get_mockup_result", 400, "task_key required")
        return await self._request("GET", f"/mockup-generator/task?task_key={task_key}")

    # ------------------------------------------------------------------
    # Tool handlers — Orders
    # ------------------------------------------------------------------

    async def _create_order(self, params: dict[str, Any]) -> dict[str, Any]:
        recipient = params.get("recipient")
        items = params.get("items")
        confirm = params.get("confirm", False)

        if not recipient or not items:
            return _format_error("printful_create_order", 400, "recipient and items required")

        body = {"recipient": recipient, "items": items}
        qs = "?confirm=true" if confirm else ""

        return await self._request("POST", f"/orders{qs}", json_body=body, timeout=60.0)

    async def _get_order(self, params: dict[str, Any]) -> dict[str, Any]:
        order_id = str(params.get("order_id", ""))
        _validate_id(order_id, "order_id")
        return await self._request("GET", f"/orders/{order_id}")

    async def _cancel_order(self, params: dict[str, Any]) -> dict[str, Any]:
        order_id = str(params.get("order_id", ""))
        _validate_id(order_id, "order_id")
        return await self._request("DELETE", f"/orders/{order_id}")

    # ------------------------------------------------------------------
    # Tool handlers — Shipping
    # ------------------------------------------------------------------

    async def _calculate_shipping(self, params: dict[str, Any]) -> dict[str, Any]:
        recipient = params.get("recipient")
        items = params.get("items")
        if not recipient or not items:
            return _format_error("printful_calculate_shipping", 400, "recipient and items required")

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
            return _format_error("printful_setup_webhook", 400, "url required")

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
