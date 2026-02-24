"""
PodClaw — Printify MCP Connector
===================================

Full CRUD for the cataloger agent: products, blueprints, mockups, orders.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import time
from typing import Any

import httpx
import structlog
from urllib.parse import urlparse

logger = structlog.get_logger(__name__)

_ALLOWED_IMAGE_HOSTS = frozenset({
    "images.fal.ai", "fal.media", "v3.fal.media",
    "cdn.ideogram.ai",
    "img.recraft.ai",
    "oaidalleapiprodscus.blob.core.windows.net",
    "your-project.supabase.co",
})


# Valid Printify webhook topics
_VALID_WEBHOOK_TOPICS = frozenset({
    "order:created", "order:updated", "order:sent-to-production",
    "order:shipping-update", "order:completed", "order:cancelled",
    "product:publish:started", "product:publish:succeeded", "product:deleted",
})

# Safe ID pattern: alphanumeric, hyphens, underscores only
_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9\-_]+$")

# Printify API pagination limits (as of Oct 2024: products max 50, orders/uploads similar)
_MAX_PAGE_LIMIT = 50


def _get_allowed_webhook_hosts() -> frozenset[str]:
    """Load allowed webhook hosts from config (env-configurable)."""
    from podclaw.config import PRINTIFY_WEBHOOK_ALLOWED_HOSTS
    return frozenset(PRINTIFY_WEBHOOK_ALLOWED_HOSTS)


def _validate_id(value: str, field_name: str) -> None:
    """Validate that an ID parameter is safe for URL interpolation."""
    if not value or not _SAFE_ID_RE.match(str(value)):
        raise ValueError(f"Invalid {field_name}: must be alphanumeric (got '{value[:50]}')")


def _clamp_limit(raw: Any, default: int = 20) -> int:
    """Clamp a page limit to Printify's API maximum (50)."""
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return default
    return max(1, min(_MAX_PAGE_LIMIT, val))


def _clamp_page(raw: Any) -> int:
    """Ensure page is a positive integer."""
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return 1
    return max(1, val)


def _resolve_and_check_ssrf(hostname: str) -> None:
    """Resolve hostname to IP and block private/reserved addresses (SSRF protection).

    Blocks: RFC1918, loopback, link-local (169.254.x — cloud metadata!),
    IPv6 loopback (::1), IPv6 link-local (fe80::), and other reserved ranges.
    """
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


def _validate_webhook_url(url: str) -> None:
    """Validate that a webhook URL is HTTPS and points to allowed domains.

    Allowed hosts are configurable via PODCLAW_WEBHOOK_ALLOWED_HOSTS env var.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise ValueError(f"Webhook URL must be HTTP(S), got: {parsed.scheme}")
    # Allow http only for localhost (dev)
    if parsed.scheme == "http" and parsed.hostname != "localhost":
        raise ValueError("Webhook URL must be HTTPS for non-localhost hosts")
    allowed = _get_allowed_webhook_hosts()
    if parsed.hostname and parsed.hostname not in allowed:
        raise ValueError(
            f"Webhook host not allowed: {parsed.hostname}. "
            f"Allowed: {', '.join(sorted(allowed))}"
        )
    # SSRF check (skip for localhost — dev only)
    if parsed.hostname and parsed.hostname != "localhost":
        _resolve_and_check_ssrf(parsed.hostname)

PRINTIFY_API = "https://api.printify.com/v1"


def _format_error(tool_name: str, status: int, detail: str) -> dict[str, Any]:
    """Standardized error response for Printify API failures."""
    return {
        "error": True,
        "tool": tool_name,
        "status": status,
        "message": detail[:500],
    }


def _normalize_print_areas(
    raw_areas: list | dict, variant_ids: list[int],
) -> list[dict]:
    """Accept multiple print_areas formats and normalize to Printify API format.

    Accepted inputs:
      1. Full format (passthrough): [{variant_ids: [...], placeholders: [...]}]
      2. Simplified list: [{position: "front", imageId: "abc123"}]
      3. Simplified dict: {"front": {position: "front", imageId: "abc123"}}
    """
    # Already in correct format
    if isinstance(raw_areas, list) and raw_areas and "variant_ids" in raw_areas[0]:
        return raw_areas

    # Dict format → convert to list
    if isinstance(raw_areas, dict):
        raw_areas = list(raw_areas.values())

    # Simplified format → transform
    if isinstance(raw_areas, list) and raw_areas:
        first = raw_areas[0]
        if "position" in first or "imageId" in first or "image_id" in first:
            placeholders = []
            for area in raw_areas:
                image_id = area.get("imageId") or area.get("image_id") or area.get("id", "")
                position = area.get("position", "front")
                placeholders.append({
                    "position": position,
                    "images": [{
                        "id": str(image_id),
                        "x": 0.5, "y": 0.5,
                        "scale": 1, "angle": 0,
                    }],
                })
            return [{"variant_ids": variant_ids, "placeholders": placeholders}]

    if not isinstance(raw_areas, list):
        logger.warning("normalize_print_areas_malformed", raw_type=type(raw_areas).__name__)
        return []
    return raw_areas


def _raise_with_detail(resp: "httpx.Response", operation: str) -> None:
    """Raise an HTTPStatusError with the API response body for better diagnostics."""
    try:
        detail = resp.json()
    except Exception:
        detail = resp.text[:500]
    raise httpx.HTTPStatusError(
        f"{operation} failed ({resp.status_code}): {detail}",
        request=resp.request,
        response=resp,
    )


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
        """Reset failure counter on successful request."""
        self.failure_count = 0
        if self.state == "half-open":
            self.state = "closed"
            logger.info("circuit_breaker_closed", message="Circuit recovered after successful request")

    def record_failure(self) -> None:
        """Increment failure counter and open circuit if threshold exceeded."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold and self.state == "closed":
            self.state = "open"
            logger.warning(
                "circuit_breaker_opened",
                failure_count=self.failure_count,
                timeout=self.timeout,
            )

    def can_attempt(self) -> bool:
        """Check if request is allowed based on circuit state."""
        if self.state == "closed":
            return True

        if self.state == "open":
            # Check if timeout has elapsed
            if self.last_failure_time and (time.time() - self.last_failure_time) >= self.timeout:
                self.state = "half-open"
                logger.info("circuit_breaker_half_open", message="Attempting recovery")
                return True
            return False

        # half-open state allows one attempt
        return True


async def _retry_with_backoff(
    operation: str,
    request_fn: Any,
    circuit_breaker: CircuitBreaker,
    max_attempts: int = 3,
) -> httpx.Response:
    """Retry HTTP requests with exponential backoff for 429/5xx errors.

    Backoff delays: 2s, 4s, 8s (doubles each retry)
    Respects Retry-After header on 429 responses.
    Records successes/failures in circuit breaker.
    """
    backoff_delays = [2.0, 4.0, 8.0]  # Exponential: 2^1, 2^2, 2^3

    for attempt in range(max_attempts):
        # Check circuit breaker before attempting
        if not circuit_breaker.can_attempt():
            logger.warning(
                "circuit_breaker_blocking_request",
                operation=operation,
                state=circuit_breaker.state,
            )
            raise httpx.HTTPStatusError(
                "Circuit breaker is open — too many consecutive failures",
                request=None,  # type: ignore
                response=None,  # type: ignore
            )

        try:
            resp = await request_fn()

            # Success — record and return
            if resp.status_code < 400:
                circuit_breaker.record_success()
                return resp

            # 429 Rate Limit — retry with Retry-After or backoff
            if resp.status_code == 429 and attempt < max_attempts - 1:
                retry_after = resp.headers.get("Retry-After")
                if retry_after:
                    try:
                        delay = float(retry_after)
                    except ValueError:
                        delay = backoff_delays[attempt]
                else:
                    delay = backoff_delays[attempt]

                logger.warning(
                    "printify_rate_limited",
                    operation=operation,
                    attempt=attempt + 1,
                    retry_after=delay,
                )
                await asyncio.sleep(delay)
                continue

            # 5xx Server Error — retry with backoff
            if resp.status_code >= 500 and attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning(
                    "printify_server_error",
                    operation=operation,
                    status=resp.status_code,
                    attempt=attempt + 1,
                    retry_delay=delay,
                )
                circuit_breaker.record_failure()
                await asyncio.sleep(delay)
                continue

            # 4xx Client Error (not 429) — don't retry, but record failure
            if resp.status_code >= 400:
                circuit_breaker.record_failure()
                return resp

        except (httpx.RequestError, httpx.TimeoutException) as exc:
            # Network/timeout errors — retry with backoff
            circuit_breaker.record_failure()
            if attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning(
                    "printify_network_error",
                    operation=operation,
                    error=str(exc)[:200],
                    attempt=attempt + 1,
                    retry_delay=delay,
                )
                await asyncio.sleep(delay)
                continue
            raise

    # All retries exhausted — raise the last response
    circuit_breaker.record_failure()
    return resp  # type: ignore


class PrintifyMCPConnector:
    """In-process MCP connector for Printify."""

    def __init__(
        self,
        api_token: str,
        shop_id: str,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ):
        self._token = api_token
        self._shop_id = shop_id
        self._supabase_url = supabase_url.rstrip("/") if supabase_url else None
        self._supabase_key = supabase_key
        self._headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "User-Agent": "PodClaw/1.0",
        }
        # Shared httpx client for connection pooling (lazy init)
        self._client: httpx.AsyncClient | None = None
        # Circuit breaker for failure detection and recovery
        self._circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60.0)

    async def _get_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        """Get or create shared httpx client with dynamic timeout.

        Timeouts: 30s reads (default), 60s writes, 120s uploads.
        """
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers=self._headers,
                timeout=timeout,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        else:
            # Update timeout if different from current
            self._client.timeout = httpx.Timeout(timeout)
        return self._client

    async def close(self) -> None:
        """Close the shared httpx client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _check_duplicate_title(self, title: str) -> dict[str, Any] | None:
        """Check if a product with similar title already exists.

        Returns duplicate product dict if found, None otherwise.
        Uses Levenshtein distance < 3 OR trigram similarity > 0.8.
        """
        if not self._supabase_url or not self._supabase_key:
            # Deduplication disabled if Supabase not configured
            logger.debug("duplicate_check_skipped", reason="Supabase not configured")
            return None

        try:
            from rapidfuzz import fuzz
            from rapidfuzz.distance import Levenshtein
        except ImportError:
            logger.warning("duplicate_check_skipped", reason="rapidfuzz not installed")
            return None

        # Query existing products (active, draft, publishing)
        url = f"{self._supabase_url}/rest/v1/products"
        headers = {
            "apikey": self._supabase_key,
            "Authorization": f"Bearer {self._supabase_key}",
            "Content-Type": "application/json",
        }
        params = {
            "select": "id,title,status",
            "status": "in.(active,draft,publishing)",
            "limit": "1000",
        }

        client = await self._get_client(timeout=10.0)
        try:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning(
                    "duplicate_check_failed",
                    status=resp.status_code,
                    detail=resp.text[:200],
                )
                return None

            products = resp.json()
            title_lower = title.lower()

            for product in products:
                existing_title = product.get("title", "")
                existing_title_lower = existing_title.lower()

                # Levenshtein distance check (< 3 = very similar)
                lev_distance = Levenshtein.distance(title_lower, existing_title_lower)
                if lev_distance < 3:
                    logger.warning(
                        "duplicate_product_detected",
                        method="levenshtein",
                        distance=lev_distance,
                        new_title=title,
                        existing_title=existing_title,
                        existing_id=product.get("id"),
                    )
                    return product

                # Trigram similarity check (> 0.8 = very similar)
                trigram_sim = fuzz.token_set_ratio(title_lower, existing_title_lower) / 100.0
                if trigram_sim > 0.8:
                    logger.warning(
                        "duplicate_product_detected",
                        method="trigram",
                        similarity=trigram_sim,
                        new_title=title,
                        existing_title=existing_title,
                        existing_id=product.get("id"),
                    )
                    return product

            logger.debug("duplicate_check_passed", title=title, checked_products=len(products))
            return None

        except Exception as exc:
            logger.warning(
                "duplicate_check_error",
                error=str(exc)[:200],
                title=title,
            )
            # Fail open: don't block product creation on check errors
            return None

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "printify_list_products": {
                "description": (
                    "List products from the Printify shop. "
                    "Returns {data: [{id, title, description, images, variants, ...}], current_page, last_page}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "limit": {"type": "integer"},
                    },
                },
                "handler": self._list_products,
            },
            "printify_create": {
                "description": (
                    "Create a new product in the Printify shop. Returns the full product object including 'id'. "
                    "variants: [{id: <variant_id>, price: <cents>, is_enabled: true}]. "
                    "print_areas: [{variant_ids: [id1,id2,...], placeholders: [{position: 'front', "
                    "images: [{id: '<upload_id>', x: 0.5, y: 0.5, scale: 1, angle: 0}]}]}]. "
                    "Set an initial conservative price (e.g. 2999 = EUR 29.99), then call "
                    "printify_get_product to get real costs and adjust."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "blueprint_id": {"type": "integer"},
                        "print_provider_id": {"type": "integer"},
                        "variants": {
                            "type": "array",
                            "description": "Array of {id: int, price: int (cents), is_enabled: bool}",
                        },
                        "print_areas": {
                            "type": "array",
                            "description": (
                                "Array of {variant_ids: [int], placeholders: [{position: str, "
                                "images: [{id: str, x: float, y: float, scale: float, angle: int}]}]}"
                            ),
                        },
                    },
                    "required": ["title", "blueprint_id", "print_provider_id", "variants", "print_areas"],
                },
                "handler": self._create_product,
            },
            "printify_update": {
                "description": (
                    "Update an existing Printify product (title, description, or variant prices). "
                    "To update prices, pass variants: [{id: <variant_id>, price: <new_price_cents>}]. "
                    "Only include fields you want to change. Returns the updated product object."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "variants": {
                            "type": "array",
                            "description": "Array of {id: int, price: int (cents)} to update prices",
                        },
                    },
                    "required": ["product_id"],
                },
                "handler": self._update_product,
            },
            "printify_get_blueprints": {
                "description": (
                    "List ALL Printify blueprints (product templates). Returns {blueprints: [{id, title, categories}]}. "
                    "Use printify_search_blueprints instead for filtered searches."
                ),
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_blueprints,
            },
            "printify_get_mockup": {
                "description": (
                    "Get mockup images for a product. Returns {images: [{src, variant_ids, is_default}], title}. "
                    "Each image has 'src' (full URL) which can be used for the storefront."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._get_mockup,
            },
            "printify_get_product": {
                "description": (
                    "Get a single product by ID. Returns the FULL product object including: "
                    "id, title, description, tags, images [{src, variant_ids, is_default}], "
                    "variants [{id, title, options (size/color), price (cents), cost (USD cents), is_enabled}], "
                    "and print_areas. The 'cost' field in each variant is the production cost in USD cents — "
                    "use this to calculate retail price (convert to EUR, apply markup)."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._get_product,
            },
            "printify_delete_product": {
                "description": (
                    "Delete a product from the Printify shop. Returns {deleted: true, product_id}. "
                    "IMPORTANT: After deleting, you MUST also update the Supabase products table "
                    "to set status='deleted' for the matching printify_id. Never leave orphaned DB records."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._delete_product,
            },
            "printify_publish": {
                "description": (
                    "Publish a product to the connected sales channel. "
                    "WARNING: Published products are LOCKED — to edit, unpublish first. "
                    "Returns {published: true, product_id}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._publish_product,
            },
            "printify_unpublish": {
                "description": "Unpublish a product. Required before editing a published product or deleting it.",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._unpublish_product,
            },
            "printify_publishing_succeeded": {
                "description": (
                    "Confirm successful publishing for custom integration. "
                    "MUST be called after printify_publish to unlock the product from 'publishing' state. "
                    "Returns {publishing_succeeded: true, product_id}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "external_id": {"type": "string", "description": "Supabase product UUID"},
                        "handle": {"type": "string", "description": "URL path e.g. /shop/<uuid>"},
                    },
                    "required": ["product_id", "external_id"],
                },
                "handler": self._publishing_succeeded,
            },
            "printify_publishing_failed": {
                "description": "Report publishing failure to Printify. Unlocks the product from 'publishing' state.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "reason": {"type": "string", "description": "Failure reason"},
                    },
                    "required": ["product_id"],
                },
                "handler": self._publishing_failed,
            },
            "printify_upload_image": {
                "description": (
                    "Upload an image to Printify via public HTTPS URL. "
                    "Returns {id: '<upload_id>', ...}. Use the returned 'id' in print_areas when creating products. "
                    "Allowed hosts: fal.ai, ideogram.ai, recraft.ai, supabase storage."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_name": {"type": "string", "description": "e.g. 'design-abc123.png'"},
                        "url": {"type": "string", "description": "Public HTTPS URL of the image"},
                    },
                    "required": ["file_name", "url"],
                },
                "handler": self._upload_image,
            },
            "printify_get_providers": {
                "description": (
                    "Get print providers for a blueprint. Returns {providers: [{id, title, location {country}}]}. "
                    "Select EU-based providers (Germany, Poland, Czech, Latvia, UK) for lower shipping costs."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"blueprint_id": {"type": "integer"}},
                    "required": ["blueprint_id"],
                },
                "handler": self._get_providers,
            },
            "printify_get_variants": {
                "description": (
                    "Get available variants (sizes/colors) for a blueprint + provider. "
                    "Returns {variants: [{id, title, options {size, color}, placeholders [{position, width, height}]}]}. "
                    "Use variant IDs when creating products."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "blueprint_id": {"type": "integer"},
                        "print_provider_id": {"type": "integer"},
                    },
                    "required": ["blueprint_id", "print_provider_id"],
                },
                "handler": self._get_variants,
            },
            "printify_get_orders": {
                "description": (
                    "List orders from the shop. Returns {data: [{id, status, line_items, total_price, ...}]}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "limit": {"type": "integer"},
                        "status": {"type": "string", "description": "Filter: pending, processing, shipped, delivered, cancelled"},
                    },
                },
                "handler": self._get_orders,
            },
            "printify_get_order_costs": {
                "description": (
                    "Get cost breakdown for a specific order. "
                    "Returns {order_id, line_items (count), total_cost_cents (USD), total_shipping_cents (USD), status}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string"}},
                    "required": ["order_id"],
                },
                "handler": self._get_order_costs,
            },
            "printify_get_shipping_profiles": {
                "description": "Get shipping profiles for the shop. Returns {profiles: [{id, title, ...}]}.",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_shipping_profiles,
            },
            "printify_search_blueprints": {
                "description": (
                    "Search blueprints by name or category. Returns {count, blueprints: [{id, title, categories}]}. "
                    "Use this instead of printify_get_blueprints when looking for specific product types "
                    "(e.g. query='mug', category='drinkware')."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search term to match in blueprint title (case-insensitive)"},
                        "category": {"type": "string", "description": "Category filter (case-insensitive, e.g. 'drinkware', 'accessories')"},
                    },
                },
                "handler": self._search_blueprints,
            },
            "printify_get_gpsr": {
                "description": (
                    "Get the auto-generated GPSR (General Product Safety Regulation) info for a product. "
                    "Printify generates this from the blueprint/provider data. "
                    "Returns {safety_information: '<HTML with EU rep, product info, warnings, care>'}. "
                    "After fetching, use printify_update to set safety_information on the product "
                    "(this is equivalent to checking the GPSR checkbox in the UI)."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string", "description": "Printify product ID"},
                    },
                    "required": ["product_id"],
                },
                "handler": self._get_gpsr,
            },
            "printify_get_blueprint_detail": {
                "description": (
                    "Get detailed blueprint info including description (material/fabric info), brand, model, and images. "
                    "The description often contains material composition (e.g. '100% ring-spun cotton'). "
                    "Returns {id, title, description, brand, model, images}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "blueprint_id": {"type": "integer", "description": "Blueprint ID from printify_get_blueprints or printify_search_blueprints"},
                    },
                    "required": ["blueprint_id"],
                },
                "handler": self._get_blueprint_detail,
            },
            # --- Shops ---
            "printify_list_shops": {
                "description": (
                    "List all connected Printify shops. "
                    "Returns {shops: [{id, title, sales_channel, ...}]} with is_current flag on the active shop."
                ),
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._list_shops,
            },
            "printify_get_shop": {
                "description": "Get details for a specific shop (defaults to current shop). Returns shop object.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "shop_id": {"type": "string", "description": "Shop ID (optional, defaults to current shop)"},
                    },
                },
                "handler": self._get_shop,
            },
            # --- Orders Write ---
            "printify_create_order": {
                "description": (
                    "Create a new order (sample/test). "
                    "Params: line_items (array of {product_id, variant_id, quantity}), "
                    "address_to (object with name, address1, city, country, zip), "
                    "shipping_method (int). Returns the created order object."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "line_items": {
                            "type": "array",
                            "description": "Array of {product_id: str, variant_id: int, quantity: int}",
                        },
                        "address_to": {
                            "type": "object",
                            "description": "Shipping address: {first_name, last_name, email, address1, city, region, country, zip}",
                        },
                        "shipping_method": {"type": "integer", "description": "Shipping method ID (1=standard, 2=express)"},
                    },
                    "required": ["line_items", "address_to", "shipping_method"],
                },
                "handler": self._create_order,
            },
            "printify_send_to_production": {
                "description": "Send an order to production manually. Params: order_id. Returns confirmation.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "Printify order ID"},
                    },
                    "required": ["order_id"],
                },
                "handler": self._send_to_production,
            },
            "printify_cancel_order": {
                "description": (
                    "Cancel an order before production. Only works if order is not yet in production. "
                    "Params: order_id. Returns {cancelled: true, order_id}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "Printify order ID"},
                    },
                    "required": ["order_id"],
                },
                "handler": self._cancel_order,
            },
            # --- Webhooks ---
            "printify_list_webhooks": {
                "description": "List active webhooks for the shop. Returns {webhooks: [{id, topic, url, ...}]}.",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._list_webhooks,
            },
            "printify_create_webhook": {
                "description": (
                    "Register a new webhook. Topics: order:created, order:updated, order:shipped, "
                    "order:completed, product:publish:started, product:deleted, etc. "
                    "Params: topic (string), url (HTTPS endpoint)."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string", "description": "Event topic (e.g. 'order:shipped')"},
                        "url": {"type": "string", "description": "HTTPS webhook endpoint URL"},
                    },
                    "required": ["topic", "url"],
                },
                "handler": self._create_webhook,
            },
            "printify_delete_webhook": {
                "description": "Delete a webhook by ID. Params: webhook_id.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "webhook_id": {"type": "string", "description": "Webhook ID to delete"},
                    },
                    "required": ["webhook_id"],
                },
                "handler": self._delete_webhook,
            },
            # --- Uploads Read ---
            "printify_list_uploads": {
                "description": (
                    "List previously uploaded images. "
                    "Returns {data: [{id, file_name, preview_url, upload_time}], current_page, last_page}."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer", "description": "Page number (default 1)"},
                        "limit": {"type": "integer", "description": "Items per page (default 20, max 100)"},
                    },
                },
                "handler": self._list_uploads,
            },
        }

    async def _list_products(self, params: dict[str, Any]) -> dict[str, Any]:
        page = _clamp_page(params.get("page", 1))
        limit = _clamp_limit(params.get("limit", 20))
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products.json?page={page}&limit={limit}"
        client = await self._get_client(timeout=30.0)  # Read operation

        async def request_fn():
            return await client.get(url, headers=self._headers)

        resp = await _retry_with_backoff("list_products", request_fn, self._circuit_breaker)
        resp.raise_for_status()
        return resp.json()

    async def _create_product(self, params: dict[str, Any]) -> dict[str, Any]:
        # Check for duplicate title before creating product
        title = params["title"]
        duplicate = await self._check_duplicate_title(title)
        if duplicate:
            return {
                "error": True,
                "tool": "printify_create",
                "status": 409,
                "message": (
                    f"Duplicate product detected: '{title}' is too similar to "
                    f"existing product '{duplicate.get('title')}' (ID: {duplicate.get('id')}). "
                    "Product creation blocked to prevent duplicates."
                ),
                "duplicate_id": duplicate.get("id"),
                "duplicate_title": duplicate.get("title"),
            }

        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products.json"

        # Normalize variants: accept both {variantId/variant_id/id, price} formats
        raw_variants = params["variants"]
        variants = []
        for v in raw_variants:
            vid = v.get("id") or v.get("variantId") or v.get("variant_id")
            variants.append({
                "id": int(vid),
                "price": int(v.get("price", 2999)),
                "is_enabled": v.get("is_enabled", v.get("isEnabled", True)),
            })

        # Normalize print_areas: accept simplified format and auto-transform
        raw_areas = params.get("print_areas", [])
        print_areas = _normalize_print_areas(raw_areas, [v["id"] for v in variants])

        body = {
            "title": params["title"],
            "description": params.get("description", ""),
            "blueprint_id": params["blueprint_id"],
            "print_provider_id": params["print_provider_id"],
            "variants": variants,
            "print_areas": print_areas,
        }
        # GPSR: pass safety_information if provided
        if params.get("safety_information"):
            body["safety_information"] = params["safety_information"]
        client = await self._get_client(timeout=60.0)  # Write operation

        async def request_fn():
            return await client.post(url, headers=self._headers, json=body)

        resp = await _retry_with_backoff("create_product", request_fn, self._circuit_breaker)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_create")
        return resp.json()

    async def _update_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        body = {k: v for k, v in params.items() if k != "product_id" and v is not None}

        # Normalize variants if present (same format flexibility as create)
        if "variants" in body:
            raw = body["variants"]
            normalized = []
            for v in raw:
                vid = v.get("id") or v.get("variantId") or v.get("variant_id")
                entry: dict[str, Any] = {"id": int(vid)}
                if "price" in v:
                    entry["price"] = int(v["price"])
                if "is_enabled" in v or "isEnabled" in v:
                    entry["is_enabled"] = v.get("is_enabled", v.get("isEnabled", True))
                normalized.append(entry)
            body["variants"] = normalized

        client = await self._get_client(timeout=60.0)  # Write operation

        async def request_fn():
            return await client.put(url, headers=self._headers, json=body)

        resp = await _retry_with_backoff("update_product", request_fn, self._circuit_breaker)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_update")
        return resp.json()

    async def _get_blueprints(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{PRINTIFY_API}/catalog/blueprints.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        return {"blueprints": resp.json()}

    async def _get_mockup(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        product = resp.json()
        return {"images": product.get("images", []), "title": product.get("title", "")}

    async def _get_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        client = await self._get_client(timeout=30.0)  # Read operation

        async def request_fn():
            return await client.get(url, headers=self._headers)

        resp = await _retry_with_backoff("get_product", request_fn, self._circuit_breaker)
        resp.raise_for_status()
        return resp.json()

    async def _delete_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        client = await self._get_client(timeout=60.0)  # Write operation

        async def request_fn():
            return await client.delete(url, headers=self._headers)

        resp = await _retry_with_backoff("delete_product", request_fn, self._circuit_breaker)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_delete")
        logger.warning(
            "printify_product_deleted",
            product_id=pid,
            reminder="Update Supabase status='deleted' for this printify_id",
        )
        return {"deleted": True, "product_id": pid}

    async def _publish_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/publish.json"
        # Selective publishing: agent can choose which fields to publish
        body = {
            "title": params.get("title", True),
            "description": params.get("description", True),
            "images": params.get("images", True),
            "variants": params.get("variants", True),
            "tags": params.get("tags", True),
        }
        client = await self._get_client(timeout=60.0)  # Write operation

        async def request_fn():
            return await client.post(url, headers=self._headers, json=body)

        resp = await _retry_with_backoff("publish_product", request_fn, self._circuit_breaker)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_publish")
        # Return actual Printify response merged with our fields
        data = resp.json() if resp.text else {}
        return {"published": True, "product_id": pid, **data}

    async def _unpublish_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/unpublish.json"
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, timeout=30)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_unpublish")
        return {"unpublished": True, "product_id": pid}

    async def _publishing_succeeded(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        _validate_id(pid, "product_id")
        external_id = params.get("external_id", pid)
        handle = params.get("handle", f"/shop/{external_id}")
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/publishing_succeeded.json"
        body = {"external": {"id": str(external_id), "handle": handle}}
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, json=body, timeout=30)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_publishing_succeeded")
        return {"publishing_succeeded": True, "product_id": pid}

    async def _publishing_failed(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        _validate_id(pid, "product_id")
        reason = params.get("reason", "Publishing failed")
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/publishing_failed.json"
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, json={"reason": reason}, timeout=30)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_publishing_failed")
        return {"publishing_failed": True, "product_id": pid}

    async def _upload_image(self, params: dict[str, Any]) -> dict[str, Any]:
        image_url = params.get("url") or params.get("image_url", "")
        file_name = params.get("file_name") or params.get("fileName", "design.png")
        _validate_image_url(image_url)
        url = f"{PRINTIFY_API}/uploads/images.json"
        body = {
            "file_name": file_name,
            "url": image_url,
        }
        client = await self._get_client(timeout=120.0)  # Upload operation

        async def request_fn():
            return await client.post(url, headers=self._headers, json=body)

        resp = await _retry_with_backoff("upload_image", request_fn, self._circuit_breaker)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_upload_image")
        return resp.json()

    async def _get_providers(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}/print_providers.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        return {"providers": resp.json()}

    async def _get_variants(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        pid = params["print_provider_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}/print_providers/{pid}/variants.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        return resp.json()

    async def _get_orders(self, params: dict[str, Any]) -> dict[str, Any]:
        _VALID_ORDER_STATUSES = {"pending", "processing", "shipped", "delivered", "cancelled"}
        page = _clamp_page(params.get("page", 1))
        limit = _clamp_limit(params.get("limit", 20))
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders.json?page={page}&limit={limit}"
        status = params.get("status", "")
        if status:
            if status not in _VALID_ORDER_STATUSES:
                raise ValueError(f"Invalid order status filter: '{status}'. Valid: {_VALID_ORDER_STATUSES}")
            url += f"&status={status}"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        return resp.json()

    async def _get_order_costs(self, params: dict[str, Any]) -> dict[str, Any]:
        oid = params["order_id"]
        _validate_id(oid, "order_id")
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders/{oid}.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        order = resp.json()
        line_items = order.get("line_items", [])
        total_cost = sum(item.get("cost", 0) for item in line_items)
        total_shipping = sum(item.get("shipping_cost", 0) for item in line_items)
        return {
            "order_id": oid,
            "line_items": len(line_items),
            "total_cost_cents": total_cost,
            "total_shipping_cents": total_shipping,
            "status": order.get("status"),
        }

    async def _get_shipping_profiles(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/shipping.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        return {"profiles": resp.json()}

    async def _get_blueprint_detail(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        resp.raise_for_status()
        data = resp.json()
        return {
            "id": data.get("id"),
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "brand": data.get("brand", ""),
            "model": data.get("model", ""),
            "images": data.get("images", []),
        }

    async def _fetch_blueprints_cached(self) -> list[dict[str, Any]]:
        """Fetch all blueprints, caching the result for the session."""
        if not hasattr(self, "_blueprints_cache") or self._blueprints_cache is None:
            result = await self._get_blueprints({})
            self._blueprints_cache = result.get("blueprints", [])
        return self._blueprints_cache

    async def _search_blueprints(self, params: dict[str, Any]) -> dict[str, Any]:
        """Search blueprints by name or category, returns filtered list."""
        query = params.get("query", "").lower()
        category = params.get("category", "").lower()

        blueprints = await self._fetch_blueprints_cached()
        results = []
        for bp in blueprints:
            title = bp.get("title", "")
            if query and query not in title.lower():
                continue
            cats = bp.get("categories", [])
            if category and category not in str(cats).lower():
                continue
            results.append({
                "id": bp["id"],
                "title": title,
                "categories": cats,
            })

        return {"count": len(results), "blueprints": results[:50]}

    async def _get_gpsr(self, params: dict[str, Any]) -> dict[str, Any]:
        """Fetch auto-generated GPSR safety information for a product."""
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/gpsr.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers, timeout=15)
        if resp.status_code >= 400:
            _raise_with_detail(resp, "printify_get_gpsr")
        return resp.json()

    # --- Shops ---

    async def _list_shops(self, params: dict[str, Any]) -> dict[str, Any]:
        """List all connected shops, marking the current one."""
        url = f"{PRINTIFY_API}/shops.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        if resp.status_code >= 400:
            return _format_error("printify_list_shops", resp.status_code, resp.text)
        shops = resp.json()
        for s in shops:
            s["is_current"] = str(s.get("id")) == str(self._shop_id)
        return {"shops": shops}

    async def _get_shop(self, params: dict[str, Any]) -> dict[str, Any]:
        """Get details for a specific shop. Locked to current shop for security."""
        # M3 fix: ignore arbitrary shop_id — always use configured shop
        sid = self._shop_id
        url = f"{PRINTIFY_API}/shops/{sid}.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        if resp.status_code >= 400:
            return _format_error("printify_get_shop", resp.status_code, resp.text)
        return resp.json()

    # --- Orders Write ---

    async def _create_order(self, params: dict[str, Any]) -> dict[str, Any]:
        """Create a new order (sample/test)."""
        # Validate line_items have required fields
        line_items = params["line_items"]
        if not isinstance(line_items, list) or not line_items:
            raise ValueError("line_items must be a non-empty array")
        for item in line_items:
            if not isinstance(item, dict):
                raise ValueError("Each line_item must be an object")
            if not item.get("product_id") or not item.get("variant_id"):
                raise ValueError("Each line_item requires product_id and variant_id")
            quantity = item.get("quantity", 1)
            if not isinstance(quantity, int) or quantity < 1 or quantity > 10:
                raise ValueError(f"Quantity must be 1-10, got: {quantity}")

        # Validate address_to has minimum required fields
        address = params["address_to"]
        if not isinstance(address, dict):
            raise ValueError("address_to must be an object")
        required_addr_fields = {"first_name", "last_name", "address1", "city", "country", "zip"}
        missing = required_addr_fields - set(address.keys())
        if missing:
            raise ValueError(f"address_to missing required fields: {missing}")

        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders.json"
        body = {
            "line_items": line_items,
            "address_to": address,
            "shipping_method": int(params["shipping_method"]),
        }
        logger.warning(
            "printify_order_created",
            line_items_count=len(line_items),
            country=address.get("country", "unknown"),
        )
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, json=body, timeout=30)
        if resp.status_code >= 400:
            return _format_error("printify_create_order", resp.status_code, resp.text)
        return resp.json()

    async def _send_to_production(self, params: dict[str, Any]) -> dict[str, Any]:
        """Send an order to production manually. IRREVERSIBLE — charges production cost."""
        oid = params["order_id"]
        _validate_id(oid, "order_id")
        logger.warning("printify_send_to_production", order_id=oid)
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders/{oid}/send_to_production.json"
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, timeout=30)
        if resp.status_code >= 400:
            return _format_error("printify_send_to_production", resp.status_code, resp.text)
        data = resp.json() if resp.text else {}
        return {"sent_to_production": True, "order_id": oid, **data}

    async def _cancel_order(self, params: dict[str, Any]) -> dict[str, Any]:
        """Cancel an order before production."""
        oid = params["order_id"]
        _validate_id(oid, "order_id")
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders/{oid}/cancel.json"
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, timeout=30)
        if resp.status_code >= 400:
            return _format_error("printify_cancel_order", resp.status_code, resp.text)
        logger.info("printify_order_cancelled", order_id=oid)
        return {"cancelled": True, "order_id": oid}

    # --- Webhooks ---

    async def _list_webhooks(self, params: dict[str, Any]) -> dict[str, Any]:
        """List active webhooks for the shop."""
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/webhooks.json"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        if resp.status_code >= 400:
            return _format_error("printify_list_webhooks", resp.status_code, resp.text)
        return {"webhooks": resp.json()}

    async def _create_webhook(self, params: dict[str, Any]) -> dict[str, Any]:
        """Register a new webhook. URL must be HTTPS and point to allowed domains."""
        topic = params["topic"]
        webhook_url = params["url"]

        # C1 fix: validate topic against whitelist
        if topic not in _VALID_WEBHOOK_TOPICS:
            raise ValueError(
                f"Invalid webhook topic: '{topic}'. "
                f"Valid topics: {', '.join(sorted(_VALID_WEBHOOK_TOPICS))}"
            )

        # C1 fix: validate URL points to our own domains only
        _validate_webhook_url(webhook_url)

        logger.warning("printify_webhook_created", topic=topic, url=webhook_url)
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/webhooks.json"
        body = {"topic": topic, "url": webhook_url}
        client = await self._get_client()
        resp = await client.post(url, headers=self._headers, json=body, timeout=15)
        if resp.status_code >= 400:
            return _format_error("printify_create_webhook", resp.status_code, resp.text)
        return resp.json()

    async def _delete_webhook(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delete a webhook by ID."""
        wid = params["webhook_id"]
        _validate_id(wid, "webhook_id")
        logger.warning("printify_webhook_deleted", webhook_id=wid)
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/webhooks/{wid}.json"
        client = await self._get_client()
        resp = await client.delete(url, headers=self._headers, timeout=15)
        if resp.status_code >= 400:
            return _format_error("printify_delete_webhook", resp.status_code, resp.text)
        return {"deleted": True, "webhook_id": wid}

    # --- Uploads Read ---

    async def _list_uploads(self, params: dict[str, Any]) -> dict[str, Any]:
        """List previously uploaded images."""
        page = _clamp_page(params.get("page", 1))
        limit = _clamp_limit(params.get("limit", 20))
        url = f"{PRINTIFY_API}/uploads.json?page={page}&limit={limit}"
        client = await self._get_client()
        resp = await client.get(url, headers=self._headers)
        if resp.status_code >= 400:
            return _format_error("printify_list_uploads", resp.status_code, resp.text)
        return resp.json()
