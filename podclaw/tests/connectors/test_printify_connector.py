"""
Tests for podclaw.connectors.printify_connector — PrintifyMCPConnector

Uses respx to mock httpx requests to the Printify API.
"""

from __future__ import annotations

import socket

import pytest
import respx
from httpx import Response

from unittest.mock import patch

from podclaw.connectors.printify_connector import (
    PrintifyMCPConnector,
    PRINTIFY_API,
    _validate_id,
    _validate_image_url,
    _validate_webhook_url,
    _resolve_and_check_ssrf,
    _clamp_limit,
    _clamp_page,
    _normalize_print_areas,
)

FAKE_TOKEN = "fake-printify-token"
FAKE_SHOP = "shop123"


@pytest.fixture()
def connector():
    return PrintifyMCPConnector(api_token=FAKE_TOKEN, shop_id=FAKE_SHOP)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

class TestToolRegistration:

    def test_get_tools_returns_many(self, connector):
        tools = connector.get_tools()
        assert len(tools) >= 20
        assert "printify_create" in tools
        assert "printify_list_products" in tools
        assert "printify_publish" in tools
        assert "printify_upload_image" in tools

    def test_each_tool_has_handler(self, connector):
        for name, tool in connector.get_tools().items():
            assert callable(tool["handler"]), f"{name} has no callable handler"


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

class TestValidators:

    def test_validate_id_valid(self):
        _validate_id("abc-123_XYZ", "test_id")  # Should not raise

    def test_validate_id_invalid(self):
        with pytest.raises(ValueError, match="Invalid test_id"):
            _validate_id("abc; DROP TABLE", "test_id")

    def test_validate_id_empty(self):
        with pytest.raises(ValueError):
            _validate_id("", "test_id")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('93.184.216.34', 0))])
    def test_validate_image_url_valid(self, mock_dns):
        _validate_image_url("https://images.fal.ai/design.png")
        _validate_image_url("https://yehvotdnhcwxjjpcznrf.supabase.co/storage/img.png")

    def test_validate_image_url_http_rejected(self):
        with pytest.raises(ValueError, match="Only HTTPS"):
            _validate_image_url("http://images.fal.ai/design.png")

    def test_validate_image_url_unknown_host_rejected(self):
        with pytest.raises(ValueError, match="not allowed"):
            _validate_image_url("https://evil.com/malware.png")

    def test_clamp_limit(self):
        assert _clamp_limit(20) == 20
        assert _clamp_limit(100) == 50  # Max is 50
        assert _clamp_limit(0) == 1     # Min is 1
        assert _clamp_limit("abc") == 20  # Default fallback
        assert _clamp_limit(None) == 20

    def test_clamp_page(self):
        assert _clamp_page(1) == 1
        assert _clamp_page(0) == 1      # Min is 1
        assert _clamp_page(-5) == 1
        assert _clamp_page("abc") == 1   # Default fallback


# ---------------------------------------------------------------------------
# Normalize print areas
# ---------------------------------------------------------------------------

class TestNormalizePrintAreas:

    def test_passthrough_full_format(self):
        areas = [{"variant_ids": [1, 2], "placeholders": []}]
        result = _normalize_print_areas(areas, [1, 2])
        assert result == areas

    def test_simplified_list_format(self):
        areas = [{"position": "front", "imageId": "img-1"}]
        result = _normalize_print_areas(areas, [100, 200])
        assert len(result) == 1
        assert result[0]["variant_ids"] == [100, 200]
        assert result[0]["placeholders"][0]["position"] == "front"

    def test_dict_format(self):
        areas = {"front": {"position": "front", "image_id": "img-1"}}
        result = _normalize_print_areas(areas, [100])
        assert len(result) == 1

    def test_empty_list(self):
        result = _normalize_print_areas([], [1])
        assert result == []


# ---------------------------------------------------------------------------
# List products
# ---------------------------------------------------------------------------

class TestListProducts:

    @respx.mock
    async def test_list_products(self, connector):
        respx.get(url__startswith=f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products.json").mock(
            return_value=Response(200, json={
                "current_page": 1,
                "last_page": 3,
                "data": [{"id": "p1", "title": "Shirt"}],
            })
        )
        result = await connector._list_products({"page": 1, "limit": 20})
        assert result["current_page"] == 1
        assert len(result["data"]) == 1


# ---------------------------------------------------------------------------
# Create product
# ---------------------------------------------------------------------------

class TestCreateProduct:

    @respx.mock
    async def test_create_product_success(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products.json").mock(
            return_value=Response(200, json={
                "id": "new-prod-1",
                "title": "Test Shirt",
            })
        )
        result = await connector._create_product({
            "title": "Test Shirt",
            "blueprint_id": 6,
            "print_provider_id": 28,
            "variants": [{"id": 100, "price": 2999}],
            "print_areas": [{"variant_ids": [100], "placeholders": []}],
        })
        assert result["id"] == "new-prod-1"

    @respx.mock
    async def test_create_product_with_flexible_variant_format(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products.json").mock(
            return_value=Response(200, json={"id": "p2"})
        )
        # Use variantId instead of id
        result = await connector._create_product({
            "title": "Mug",
            "blueprint_id": 450,
            "print_provider_id": 1,
            "variants": [{"variantId": 200, "price": 1999, "isEnabled": True}],
            "print_areas": [],
        })
        assert result["id"] == "p2"

    @respx.mock
    async def test_create_product_api_error(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products.json").mock(
            return_value=Response(400, json={"error": "Invalid blueprint"})
        )
        import httpx
        with pytest.raises(httpx.HTTPStatusError):
            await connector._create_product({
                "title": "Bad",
                "blueprint_id": 99999,
                "print_provider_id": 1,
                "variants": [{"id": 1, "price": 100}],
                "print_areas": [],
            })


# ---------------------------------------------------------------------------
# Delete product
# ---------------------------------------------------------------------------

class TestDeleteProduct:

    @respx.mock
    async def test_delete_product_success(self, connector):
        respx.delete(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products/prod-1.json").mock(
            return_value=Response(200, text="")
        )
        result = await connector._delete_product({"product_id": "prod-1"})
        assert result["deleted"] is True
        assert result["product_id"] == "prod-1"


# ---------------------------------------------------------------------------
# Publish flow
# ---------------------------------------------------------------------------

class TestPublishFlow:

    @respx.mock
    async def test_publish_product(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products/p1/publish.json").mock(
            return_value=Response(200, json={})
        )
        result = await connector._publish_product({"product_id": "p1"})
        assert result["published"] is True

    @respx.mock
    async def test_unpublish_product(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products/p1/unpublish.json").mock(
            return_value=Response(200, text="")
        )
        result = await connector._unpublish_product({"product_id": "p1"})
        assert result["unpublished"] is True

    @respx.mock
    async def test_publishing_succeeded(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products/p1/publishing_succeeded.json").mock(
            return_value=Response(200, text="")
        )
        result = await connector._publishing_succeeded({
            "product_id": "p1",
            "external_id": "supabase-uuid",
        })
        assert result["publishing_succeeded"] is True

    @respx.mock
    async def test_publishing_failed(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/products/p1/publishing_failed.json").mock(
            return_value=Response(200, text="")
        )
        result = await connector._publishing_failed({
            "product_id": "p1",
            "reason": "Image quality too low",
        })
        assert result["publishing_failed"] is True


# ---------------------------------------------------------------------------
# Upload image
# ---------------------------------------------------------------------------

class TestUploadImage:

    @respx.mock
    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('93.184.216.34', 0))])
    async def test_upload_image_success(self, mock_dns, connector):
        respx.post(f"{PRINTIFY_API}/uploads/images.json").mock(
            return_value=Response(200, json={
                "id": "upload-123",
                "file_name": "design.png",
                "preview_url": "https://images.printify.com/preview.png",
            })
        )
        result = await connector._upload_image({
            "file_name": "design.png",
            "url": "https://images.fal.ai/design.png",
        })
        assert result["id"] == "upload-123"

    async def test_upload_image_invalid_host_rejected(self, connector):
        with pytest.raises(ValueError, match="not allowed"):
            await connector._upload_image({
                "file_name": "hack.png",
                "url": "https://evil.com/hack.png",
            })


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------

class TestWebhooks:

    @respx.mock
    async def test_list_webhooks(self, connector):
        respx.get(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/webhooks.json").mock(
            return_value=Response(200, json=[{"id": "wh-1", "topic": "order:created"}])
        )
        result = await connector._list_webhooks({})
        assert len(result["webhooks"]) == 1

    async def test_create_webhook_invalid_topic_rejected(self, connector):
        with pytest.raises(ValueError, match="Invalid webhook topic"):
            await connector._create_webhook({
                "topic": "hack:exploit",
                "url": "https://localhost/webhook",
            })

    async def test_create_webhook_invalid_url_rejected(self, connector):
        with pytest.raises(ValueError, match="not allowed"):
            await connector._create_webhook({
                "topic": "order:created",
                "url": "https://evil.com/steal-data",
            })


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class TestOrders:

    @respx.mock
    async def test_get_orders(self, connector):
        respx.get(url__startswith=f"{PRINTIFY_API}/shops/{FAKE_SHOP}/orders.json").mock(
            return_value=Response(200, json={
                "current_page": 1,
                "data": [{"id": "ord-1", "status": "pending"}],
            })
        )
        result = await connector._get_orders({})
        assert "data" in result

    async def test_get_orders_invalid_status_rejected(self, connector):
        with pytest.raises(ValueError, match="Invalid order status"):
            await connector._get_orders({"status": "hacked"})

    @respx.mock
    async def test_get_order_costs(self, connector):
        respx.get(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/orders/ord-1.json").mock(
            return_value=Response(200, json={
                "id": "ord-1",
                "status": "pending",
                "line_items": [
                    {"cost": 800, "shipping_cost": 350},
                    {"cost": 600, "shipping_cost": 350},
                ],
            })
        )
        result = await connector._get_order_costs({"order_id": "ord-1"})
        assert result["total_cost_cents"] == 1400
        assert result["total_shipping_cents"] == 700
        assert result["line_items"] == 2

    @respx.mock
    async def test_create_order_success(self, connector):
        respx.post(f"{PRINTIFY_API}/shops/{FAKE_SHOP}/orders.json").mock(
            return_value=Response(200, json={"id": "ord-new"})
        )
        result = await connector._create_order({
            "line_items": [{"product_id": "p1", "variant_id": 100, "quantity": 1}],
            "address_to": {
                "first_name": "John",
                "last_name": "Doe",
                "address1": "123 Main St",
                "city": "Berlin",
                "country": "DE",
                "zip": "10115",
            },
            "shipping_method": 1,
        })
        assert result["id"] == "ord-new"

    async def test_create_order_empty_line_items(self, connector):
        with pytest.raises(ValueError, match="non-empty"):
            await connector._create_order({
                "line_items": [],
                "address_to": {"first_name": "X", "last_name": "Y", "address1": "Z", "city": "A", "country": "B", "zip": "C"},
                "shipping_method": 1,
            })

    async def test_create_order_missing_address_fields(self, connector):
        with pytest.raises(ValueError, match="missing required fields"):
            await connector._create_order({
                "line_items": [{"product_id": "p1", "variant_id": 1, "quantity": 1}],
                "address_to": {"first_name": "John"},
                "shipping_method": 1,
            })

    async def test_create_order_quantity_validation(self, connector):
        with pytest.raises(ValueError, match="Quantity must be 1-10"):
            await connector._create_order({
                "line_items": [{"product_id": "p1", "variant_id": 1, "quantity": 99}],
                "address_to": {"first_name": "J", "last_name": "D", "address1": "St", "city": "C", "country": "DE", "zip": "00"},
                "shipping_method": 1,
            })


# ---------------------------------------------------------------------------
# Shops
# ---------------------------------------------------------------------------

class TestShops:

    @respx.mock
    async def test_list_shops(self, connector):
        respx.get(f"{PRINTIFY_API}/shops.json").mock(
            return_value=Response(200, json=[
                {"id": "shop123", "title": "My Shop"},
                {"id": "shop456", "title": "Other Shop"},
            ])
        )
        result = await connector._list_shops({})
        assert len(result["shops"]) == 2
        # Current shop should be marked
        current = [s for s in result["shops"] if s["is_current"]]
        assert len(current) == 1
        assert current[0]["id"] == "shop123"

    @respx.mock
    async def test_get_shop_locked_to_current(self, connector):
        """get_shop ignores arbitrary shop_id and always uses configured shop."""
        respx.get(f"{PRINTIFY_API}/shops/{FAKE_SHOP}.json").mock(
            return_value=Response(200, json={"id": FAKE_SHOP, "title": "My Shop"})
        )
        result = await connector._get_shop({"shop_id": "attacker-shop-id"})
        assert result["id"] == FAKE_SHOP


# ---------------------------------------------------------------------------
# SSRF Protection
# ---------------------------------------------------------------------------

class TestSSRFProtection:

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('10.0.0.1', 0))])
    def test_private_ip_blocked(self, mock_dns):
        with pytest.raises(ValueError, match="SSRF blocked"):
            _resolve_and_check_ssrf("evil.com")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('127.0.0.1', 0))])
    def test_loopback_blocked(self, mock_dns):
        with pytest.raises(ValueError, match="SSRF blocked"):
            _resolve_and_check_ssrf("evil.com")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('169.254.169.254', 0))])
    def test_link_local_metadata_blocked(self, mock_dns):
        """Cloud metadata endpoint (169.254.169.254) must be blocked."""
        with pytest.raises(ValueError, match="SSRF blocked"):
            _resolve_and_check_ssrf("evil.com")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(2, 1, 6, '', ('93.184.216.34', 0))])
    def test_public_ip_allowed(self, mock_dns):
        # Should not raise
        _resolve_and_check_ssrf("example.com")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           return_value=[(10, 1, 6, '', ('::1', 0, 0, 0))])
    def test_ipv6_loopback_blocked(self, mock_dns):
        with pytest.raises(ValueError, match="SSRF blocked"):
            _resolve_and_check_ssrf("evil.com")

    @patch("podclaw.connectors.printify_connector.socket.getaddrinfo",
           side_effect=socket.gaierror("DNS resolution failed"))
    def test_dns_failure_blocked(self, mock_dns):
        with pytest.raises(ValueError, match="DNS resolution failed"):
            _resolve_and_check_ssrf("nonexistent.invalid")


# ---------------------------------------------------------------------------
# Connection pooling
# ---------------------------------------------------------------------------

class TestConnectionPooling:

    async def test_client_lazy_init(self, connector):
        assert connector._client is None
        client = await connector._get_client()
        assert client is not None
        assert connector._client is client

    async def test_client_reused(self, connector):
        c1 = await connector._get_client()
        c2 = await connector._get_client()
        assert c1 is c2

    async def test_close_cleans_up(self, connector):
        await connector._get_client()
        assert connector._client is not None
        await connector.close()
        assert connector._client is None
