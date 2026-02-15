"""
PodClaw — Printify MCP Connector
===================================

Full CRUD for the cataloger agent: products, blueprints, mockups, orders.
"""

from __future__ import annotations

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


def _validate_image_url(url: str) -> None:
    """Validate that the image URL is HTTPS and from an allowed host."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS URLs allowed, got: {parsed.scheme}")
    if parsed.hostname and parsed.hostname not in _ALLOWED_IMAGE_HOSTS:
        raise ValueError(f"Image host not allowed: {parsed.hostname}")

PRINTIFY_API = "https://api.printify.com/v1"


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
                "description": "List products from the Printify shop",
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
                "description": "Create a new product in the Printify shop",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "blueprint_id": {"type": "integer"},
                        "print_provider_id": {"type": "integer"},
                        "variants": {"type": "array"},
                        "print_areas": {"type": "array"},
                    },
                    "required": ["title", "blueprint_id", "print_provider_id", "variants", "print_areas"],
                },
                "handler": self._create_product,
            },
            "printify_update": {
                "description": "Update an existing Printify product",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "variants": {"type": "array"},
                    },
                    "required": ["product_id"],
                },
                "handler": self._update_product,
            },
            "printify_get_blueprints": {
                "description": "List available Printify blueprints (product templates)",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_blueprints,
            },
            "printify_get_mockup": {
                "description": "Get mockup image for a product",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._get_mockup,
            },
            "printify_get_product": {
                "description": "Get a single product by ID from the Printify shop",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._get_product,
            },
            "printify_delete_product": {
                "description": "Delete a product from the Printify shop",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._delete_product,
            },
            "printify_publish": {
                "description": "Publish a product to the connected sales channel",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._publish_product,
            },
            "printify_unpublish": {
                "description": "Unpublish a product from the connected sales channel",
                "input_schema": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
                "handler": self._unpublish_product,
            },
            "printify_upload_image": {
                "description": "Upload an image to Printify via public URL",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_name": {"type": "string"},
                        "url": {"type": "string"},
                    },
                    "required": ["file_name", "url"],
                },
                "handler": self._upload_image,
            },
            "printify_get_providers": {
                "description": "Get print providers for a blueprint",
                "input_schema": {
                    "type": "object",
                    "properties": {"blueprint_id": {"type": "integer"}},
                    "required": ["blueprint_id"],
                },
                "handler": self._get_providers,
            },
            "printify_get_variants": {
                "description": "Get available variants (sizes/colors) for a blueprint + provider",
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
                "description": "List orders from the Printify shop",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "limit": {"type": "integer"},
                        "status": {"type": "string", "description": "Filter by status"},
                    },
                },
                "handler": self._get_orders,
            },
            "printify_get_order_costs": {
                "description": "Get cost breakdown for a specific order",
                "input_schema": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string"}},
                    "required": ["order_id"],
                },
                "handler": self._get_order_costs,
            },
            "printify_get_shipping_profiles": {
                "description": "Get shipping profiles for the shop",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_shipping_profiles,
            },
        }

    async def _list_products(self, params: dict[str, Any]) -> dict[str, Any]:
        page = params.get("page", 1)
        limit = params.get("limit", 20)
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products.json?page={page}&limit={limit}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _create_product(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products.json"
        body = {
            "title": params["title"],
            "description": params.get("description", ""),
            "blueprint_id": params["blueprint_id"],
            "print_provider_id": params["print_provider_id"],
            "variants": params["variants"],
            "print_areas": params["print_areas"],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()

    async def _update_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}.json"
        body = {k: v for k, v in params.items() if k != "product_id" and v is not None}
        async with httpx.AsyncClient() as client:
            resp = await client.put(url, headers=self._headers, json=body)
            resp.raise_for_status()
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
            resp = await client.delete(url, headers=self._headers)
            resp.raise_for_status()
            return {"deleted": True, "product_id": pid}

    async def _publish_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/publish.json"
        body = {
            "title": True,
            "description": True,
            "images": True,
            "variants": True,
            "tags": True,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
            return {"published": True, "product_id": pid}

    async def _unpublish_product(self, params: dict[str, Any]) -> dict[str, Any]:
        pid = params["product_id"]
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/products/{pid}/unpublish.json"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers)
            resp.raise_for_status()
            return {"unpublished": True, "product_id": pid}

    async def _upload_image(self, params: dict[str, Any]) -> dict[str, Any]:
        _validate_image_url(params["url"])
        url = f"{PRINTIFY_API}/uploads/images.json"
        body = {
            "file_name": params["file_name"],
            "url": params["url"],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
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
        page = params.get("page", 1)
        limit = params.get("limit", 20)
        url = f"{PRINTIFY_API}/shops/{self._shop_id}/orders.json?page={page}&limit={limit}"
        if params.get("status"):
            url += f"&status={params['status']}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _get_order_costs(self, params: dict[str, Any]) -> dict[str, Any]:
        oid = params["order_id"]
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
