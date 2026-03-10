"""
Tests for podclaw.connectors.printful_connector — PrintfulMCPConnector

Uses respx to mock httpx requests to the Printful API.
"""

from __future__ import annotations

import socket
import time

import pytest
import respx
from httpx import Response
from unittest.mock import patch

from podclaw.connectors.printful_connector import (
    PrintfulMCPConnector,
    CircuitBreaker,
    _validate_id,
    _resolve_and_check_ssrf,
    _validate_image_url,
)

FAKE_TOKEN = "fake-printful-token"
FAKE_STORE = "store123"
BASE = "https://api.printful.com"


@pytest.fixture()
def connector():
    return PrintfulMCPConnector(api_token=FAKE_TOKEN, store_id=FAKE_STORE)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

class TestToolRegistration:

    def test_get_tools_returns_18(self, connector):
        tools = connector.get_tools()
        assert len(tools) == 18

    def test_expected_tools_present(self, connector):
        tools = connector.get_tools()
        expected = [
            "printful_get_catalog", "printful_get_catalog_product",
            "printful_get_printfiles", "printful_list_products",
            "printful_get_product", "printful_create_product",
            "printful_update_product", "printful_delete_product",
            "printful_upload_file", "printful_get_file",
            "printful_create_mockup", "printful_get_mockup_result",
            "printful_create_order", "printful_get_order",
            "printful_cancel_order", "printful_calculate_shipping",
            "printful_list_webhooks", "printful_setup_webhook",
        ]
        for name in expected:
            assert name in tools, f"Missing tool: {name}"

    def test_each_tool_has_handler(self, connector):
        for name, tool in connector.get_tools().items():
            assert callable(tool["handler"]), f"{name} has no callable handler"

    def test_each_tool_has_description(self, connector):
        for name, tool in connector.get_tools().items():
            assert "description" in tool, f"{name} missing description"
            assert len(tool["description"]) > 10, f"{name} description too short"


# ---------------------------------------------------------------------------
# Validators (raise ValueError on invalid input)
# ---------------------------------------------------------------------------

class TestValidators:

    def test_validate_id_valid(self):
        _validate_id("abc-123_def", "test_field")  # should not raise

    def test_validate_id_invalid_semicolon(self):
        with pytest.raises(ValueError):
            _validate_id("abc; DROP TABLE", "test_field")

    def test_validate_id_empty(self):
        with pytest.raises(ValueError):
            _validate_id("", "test_field")

    def test_validate_id_path_traversal(self):
        with pytest.raises(ValueError):
            _validate_id("abc/../../etc", "test_field")

    def test_validate_image_url_valid(self):
        _validate_image_url("https://files.cdn.printful.com/files/abc/123.png")

    def test_validate_image_url_javascript(self):
        with pytest.raises(ValueError):
            _validate_image_url("javascript:alert(1)")

    def test_validate_image_url_file_scheme(self):
        with pytest.raises(ValueError):
            _validate_image_url("file:///etc/passwd")

    def test_validate_image_url_unauthorized_host(self):
        with pytest.raises(ValueError):
            _validate_image_url("https://evil.com/hack.png")

    def test_ssrf_blocks_private_ips(self):
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(socket.AF_INET, 0, 0, "", ("127.0.0.1", 443))]
            with pytest.raises(ValueError, match="SSRF"):
                _resolve_and_check_ssrf("internal.corp")

    def test_ssrf_allows_public_ips(self):
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(socket.AF_INET, 0, 0, "", ("104.18.0.1", 443))]
            _resolve_and_check_ssrf("api.printful.com")  # should not raise


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

class TestCircuitBreaker:

    def test_starts_closed(self):
        cb = CircuitBreaker(failure_threshold=3, timeout=10.0)
        assert cb.can_attempt() is True

    def test_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3, timeout=10.0)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is False

    def test_success_resets(self):
        cb = CircuitBreaker(failure_threshold=3, timeout=10.0)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.can_attempt() is True

    def test_half_open_after_timeout(self):
        cb = CircuitBreaker(failure_threshold=2, timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is False
        time.sleep(0.15)
        assert cb.can_attempt() is True  # half-open


# ---------------------------------------------------------------------------
# API calls (mocked with respx)
# ---------------------------------------------------------------------------

class TestAPICalls:

    @pytest.mark.asyncio
    @respx.mock
    async def test_list_products(self, connector):
        respx.get(url__startswith=f"{BASE}/store/products").mock(
            return_value=Response(200, json={
                "code": 200,
                "result": [{"id": 1, "name": "Test Tee"}],
                "paging": {"total": 1},
            })
        )
        tools = connector.get_tools()
        result = await tools["printful_list_products"]["handler"]({})
        assert isinstance(result, (list, dict))

    @pytest.mark.asyncio
    @respx.mock
    async def test_get_catalog(self, connector):
        respx.get(f"{BASE}/products").mock(
            return_value=Response(200, json={
                "code": 200,
                "result": [{"id": 71, "title": "Unisex Staple T-Shirt"}],
            })
        )
        tools = connector.get_tools()
        result = await tools["printful_get_catalog"]["handler"]({})
        assert isinstance(result, (list, dict))

    @pytest.mark.asyncio
    @respx.mock
    async def test_create_product(self, connector):
        respx.post(f"{BASE}/store/products").mock(
            return_value=Response(200, json={
                "code": 200,
                "result": {"id": 456, "name": "New Product"},
            })
        )
        tools = connector.get_tools()
        result = await tools["printful_create_product"]["handler"]({
            "product": {"title": "New Product", "variants": []},
        })
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    @respx.mock
    async def test_calculate_shipping(self, connector):
        respx.post(f"{BASE}/shipping/rates").mock(
            return_value=Response(200, json={
                "code": 200,
                "result": [{"id": "STANDARD", "name": "Standard", "rate": "4.99"}],
            })
        )
        tools = connector.get_tools()
        result = await tools["printful_calculate_shipping"]["handler"]({
            "recipient": {"country_code": "DE"},
            "items": [{"variant_id": "123", "quantity": 1}],
        })
        assert isinstance(result, (list, dict))
