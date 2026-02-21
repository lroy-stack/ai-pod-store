"""
PodClaw — Printify MCP Connector
===================================

Full CRUD for the cataloger agent: products, blueprints, mockups, orders.
"""

from __future__ import annotations

import re
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
    "product:publish:started", "product:deleted",
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


def _validate_image_url(url: str) -> None:
    """Validate that the image URL is HTTPS and from an allowed host."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS URLs allowed, got: {parsed.scheme}")
    if parsed.hostname and parsed.hostname not in _ALLOWED_IMAGE_HOSTS:
        raise ValueError(f"Image host not allowed: {parsed.hostname}")


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

    return raw_areas if isinstance(raw_areas, list) else []


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


class PrintifyMCPConnector:
    """In-process MCP connector for Printify."""

    def __init__(self, api_token: str, shop_id: str):
        self._token = api_token
        self._shop_id = shop_id
        self._headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "User-Agent": "PodClaw/1.0",
        }

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
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _create_product(self, params: dict[str, Any]) -> dict[str, Any]:
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
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body, timeout=30)
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

        async with httpx.AsyncClient() as client:
            resp = await client.put(url, headers=self._headers, json=body, timeout=30)
            if resp.status_code >= 400:
                _raise_with_detail(resp, "printify_update")
            return resp.json()

    async def _get_blueprints(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{PRINTIFY_API}/catalog/blueprints.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return {"blueprints": resp.json()}

    async def _get_mockup(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            product = resp.json()
            return {"images": product.get("images", []), "title": product.get("title", "")}

    async def _get_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _delete_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        async with httpx.AsyncClient() as client:
            resp = await client.delete(url, headers=self._headers, timeout=30)
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
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body, timeout=30)
            if resp.status_code >= 400:
                _raise_with_detail(resp, "printify_publish")
            # Return actual Printify response merged with our fields
            data = resp.json() if resp.text else {}
            return {"published": True, "product_id": pid, **data}

    async def _unpublish_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/unpublish.json"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, timeout=30)
            if resp.status_code >= 400:
                _raise_with_detail(resp, "printify_unpublish")
            return {"unpublished": True, "product_id": pid}

    async def _upload_image(self, params: dict[str, Any]) -> dict[str, Any]:
        image_url = params.get("url") or params.get("image_url", "")
        file_name = params.get("file_name") or params.get("fileName", "design.png")
        _validate_image_url(image_url)
        url = f"{PRINTIFY_API}/uploads/images.json"
        body = {
            "file_name": file_name,
            "url": image_url,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body, timeout=60)
            if resp.status_code >= 400:
                _raise_with_detail(resp, "printify_upload_image")
            return resp.json()

    async def _get_providers(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}/print_providers.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return {"providers": resp.json()}

    async def _get_variants(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        pid = params["print_provider_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}/print_providers/{pid}/variants.json"
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _get_order_costs(self, params: dict[str, Any]) -> dict[str, Any]:
        oid = params["order_id"]
        _validate_id(oid, "order_id")
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders/{oid}.json"
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return {"profiles": resp.json()}

    async def _get_blueprint_detail(self, params: dict[str, Any]) -> dict[str, Any]:
        bid = params["blueprint_id"]
        url = f"{PRINTIFY_API}/catalog/blueprints/{bid}.json"
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers, timeout=15)
            if resp.status_code >= 400:
                _raise_with_detail(resp, "printify_get_gpsr")
            return resp.json()

    # --- Shops ---

    async def _list_shops(self, params: dict[str, Any]) -> dict[str, Any]:
        """List all connected shops, marking the current one."""
        url = f"{PRINTIFY_API}/shops.json"
        async with httpx.AsyncClient(timeout=15) as client:
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
        async with httpx.AsyncClient(timeout=15) as client:
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
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, timeout=30)
            if resp.status_code >= 400:
                return _format_error("printify_cancel_order", resp.status_code, resp.text)
            logger.info("printify_order_cancelled", order_id=oid)
            return {"cancelled": True, "order_id": oid}

    # --- Webhooks ---

    async def _list_webhooks(self, params: dict[str, Any]) -> dict[str, Any]:
        """List active webhooks for the shop."""
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/webhooks.json"
        async with httpx.AsyncClient(timeout=15) as client:
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
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=self._headers)
            if resp.status_code >= 400:
                return _format_error("printify_list_uploads", resp.status_code, resp.text)
            return resp.json()
