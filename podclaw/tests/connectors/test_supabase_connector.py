"""
Tests for podclaw.connectors.supabase_connector — SupabaseMCPConnector

Uses respx to mock httpx requests to the Supabase REST API.
"""

from __future__ import annotations

import base64

import pytest
import respx
from httpx import Response

from podclaw.connectors.supabase_connector import SupabaseMCPConnector

FAKE_URL = "https://fake-supabase.local"
FAKE_KEY = "fake-service-key"


@pytest.fixture()
def connector():
    return SupabaseMCPConnector(url=FAKE_URL, service_key=FAKE_KEY)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

class TestToolRegistration:

    def test_get_tools_returns_all(self, connector):
        tools = connector.get_tools()
        expected = {
            "supabase_query", "supabase_insert", "supabase_update",
            "supabase_delete", "supabase_rpc", "supabase_vector_search",
            "supabase_upload_image",
        }
        assert set(tools.keys()) == expected

    def test_each_tool_has_handler(self, connector):
        for name, tool in connector.get_tools().items():
            assert callable(tool["handler"]), f"{name} has no callable handler"
            assert "input_schema" in tool
            assert "description" in tool


# ---------------------------------------------------------------------------
# Table name validation
# ---------------------------------------------------------------------------

class TestTableValidation:

    def test_valid_table_name(self, connector):
        assert connector._validate_table("products") == "products"
        assert connector._validate_table("product_variants") == "product_variants"

    def test_invalid_table_name_raises(self, connector):
        with pytest.raises(ValueError, match="Invalid table name"):
            connector._validate_table("products; DROP TABLE--")

    def test_path_traversal_blocked(self, connector):
        with pytest.raises(ValueError, match="Invalid table name"):
            connector._validate_table("../../../etc/passwd")


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

class TestQuery:

    @respx.mock
    async def test_basic_query(self, connector):
        rows = [{"id": "1", "title": "Test"}]
        respx.get(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(200, json=rows)
        )
        result = await connector._query({"table": "products"})
        assert result["data"] == rows
        assert result["count"] == 1

    @respx.mock
    async def test_query_with_filters(self, connector):
        respx.get(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(200, json=[])
        )
        result = await connector._query({
            "table": "products",
            "filters": {"status": "active"},
            "select": "id,title",
            "limit": 10,
            "order": "created_at",
        })
        assert result["count"] == 0

    @respx.mock
    async def test_query_http_error(self, connector):
        respx.get(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(500, text="Internal Server Error")
        )
        with pytest.raises(Exception):
            await connector._query({"table": "products"})


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------

class TestInsert:

    @respx.mock
    async def test_insert_single_row(self, connector):
        row = {"id": "uuid-1", "title": "New Product"}
        respx.post(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(201, json=[row])
        )
        result = await connector._insert({"table": "products", "data": row})
        assert result["status"] == "inserted"
        assert result["data"] == [row]

    @respx.mock
    async def test_insert_batch(self, connector):
        rows = [{"title": "A"}, {"title": "B"}]
        respx.post(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(201, json=rows)
        )
        result = await connector._insert({"table": "products", "data": rows})
        assert len(result["data"]) == 2


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

class TestUpdate:

    @respx.mock
    async def test_update_with_filters(self, connector):
        updated = [{"id": "1", "title": "Updated"}]
        respx.patch(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(200, json=updated)
        )
        result = await connector._update({
            "table": "products",
            "data": {"title": "Updated"},
            "filters": {"id": "1"},
        })
        assert result["status"] == "updated"

    async def test_update_without_filters_blocked(self, connector):
        result = await connector._update({
            "table": "products",
            "data": {"title": "Oops"},
            "filters": {},
        })
        assert "error" in result
        assert "Filters are required" in result["error"]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

class TestDelete:

    @respx.mock
    async def test_delete_with_filters(self, connector):
        deleted = [{"id": "1"}]
        respx.delete(f"{FAKE_URL}/rest/v1/products").mock(
            return_value=Response(200, json=deleted)
        )
        result = await connector._delete({
            "table": "products",
            "filters": {"id": "1"},
        })
        assert result["count"] == 1
        assert result["deleted"] == deleted

    async def test_delete_without_filters_blocked(self, connector):
        result = await connector._delete({
            "table": "products",
            "filters": {},
        })
        assert "error" in result
        assert "Filters are required" in result["error"]

    @respx.mock
    async def test_delete_empty_response(self, connector):
        respx.delete(f"{FAKE_URL}/rest/v1/designs").mock(
            return_value=Response(200, text="")
        )
        result = await connector._delete({
            "table": "designs",
            "filters": {"id": "x"},
        })
        assert result["count"] == 0


# ---------------------------------------------------------------------------
# RPC
# ---------------------------------------------------------------------------

class TestRPC:

    @respx.mock
    async def test_rpc_call(self, connector):
        respx.post(f"{FAKE_URL}/rest/v1/rpc/get_product_stats").mock(
            return_value=Response(200, json={"total": 42})
        )
        result = await connector._rpc({
            "function_name": "get_product_stats",
            "params": {},
        })
        assert result["data"]["total"] == 42

    async def test_rpc_invalid_function_name(self, connector):
        with pytest.raises(ValueError, match="Invalid function name"):
            await connector._rpc({"function_name": "DROP TABLE; --"})


# ---------------------------------------------------------------------------
# Vector search
# ---------------------------------------------------------------------------

class TestVectorSearch:

    @respx.mock
    async def test_vector_search_calls_rpc(self, connector):
        respx.post(f"{FAKE_URL}/rest/v1/rpc/match_products").mock(
            return_value=Response(200, json=[{"id": "1", "similarity": 0.9}])
        )
        result = await connector._vector_search({
            "table": "products",
            "query_embedding": [0.1] * 768,
        })
        assert result["data"][0]["similarity"] == 0.9


# ---------------------------------------------------------------------------
# Upload image
# ---------------------------------------------------------------------------

class TestUploadImage:

    @respx.mock
    async def test_upload_from_base64(self, connector):
        fake_b64 = base64.b64encode(b"fake png data").decode()
        # Mock the upload endpoint
        respx.post(url__startswith=f"{FAKE_URL}/storage/v1/object/designs/").mock(
            return_value=Response(200, json={"Key": "designs/test.png"})
        )
        result = await connector._upload_image({
            "file_name": "test.png",
            "image_base64": fake_b64,
        })
        assert "url" in result
        assert result["bucket"] == "designs"
        assert result["size_bytes"] > 0

    @respx.mock
    async def test_upload_from_url(self, connector):
        # Mock downloading the image
        respx.get("https://example.com/cat.png").mock(
            return_value=Response(200, content=b"png bytes", headers={"content-type": "image/png"})
        )
        # Mock the upload
        respx.post(url__startswith=f"{FAKE_URL}/storage/v1/object/designs/").mock(
            return_value=Response(200, json={"Key": "designs/cat.png"})
        )
        result = await connector._upload_image({
            "file_name": "cat.png",
            "image_url": "https://example.com/cat.png",
        })
        assert "url" in result

    async def test_upload_no_source_returns_error(self, connector):
        result = await connector._upload_image({"file_name": "test.png"})
        assert "error" in result

    @respx.mock
    async def test_upload_too_large_returns_error(self, connector):
        # 6MB of data (exceeds 5MB limit)
        big_data = base64.b64encode(b"x" * (6 * 1024 * 1024)).decode()
        result = await connector._upload_image({
            "file_name": "big.png",
            "image_base64": big_data,
        })
        assert "error" in result
        assert "too large" in result["error"]

    @respx.mock
    async def test_upload_failure_returns_error(self, connector):
        fake_b64 = base64.b64encode(b"small").decode()
        respx.post(url__startswith=f"{FAKE_URL}/storage/v1/object/designs/").mock(
            return_value=Response(413, text="Payload too large")
        )
        result = await connector._upload_image({
            "file_name": "test.png",
            "image_base64": fake_b64,
        })
        assert "error" in result
