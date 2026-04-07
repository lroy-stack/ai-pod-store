"""
Tests for podclaw.connectors.stripe_connector — StripeMCPConnector
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from podclaw.connectors.stripe_connector import StripeMCPConnector, STRIPE_API

FAKE_KEY = "sk_test_fake"


@pytest.fixture()
def connector():
    return StripeMCPConnector(secret_key=FAKE_KEY)


class TestToolRegistration:

    def test_get_tools_returns_all(self, connector):
        tools = connector.get_tools()
        expected = {
            "stripe_list_charges", "stripe_get_balance", "stripe_get_revenue_report",
            "stripe_create_refund", "stripe_list_disputes", "stripe_get_invoice",
            "stripe_list_payouts",
        }
        assert set(tools.keys()) == expected


class TestListCharges:

    @respx.mock
    async def test_list_charges_success(self, connector):
        respx.get(url__startswith=f"{STRIPE_API}/charges").mock(
            return_value=Response(200, json={
                "data": [{"id": "ch_1", "amount": 2999, "paid": True}],
                "has_more": False,
            })
        )
        result = await connector._list_charges({"limit": 10})
        assert len(result["charges"]) == 1
        assert result["has_more"] is False


class TestGetBalance:

    @respx.mock
    async def test_get_balance(self, connector):
        respx.get(f"{STRIPE_API}/balance").mock(
            return_value=Response(200, json={
                "available": [{"amount": 5000, "currency": "eur"}],
                "pending": [{"amount": 1000, "currency": "eur"}],
            })
        )
        result = await connector._get_balance({})
        assert "available" in result


class TestCreateRefund:

    @respx.mock
    async def test_create_refund(self, connector):
        respx.post(f"{STRIPE_API}/refunds").mock(
            return_value=Response(200, json={
                "id": "re_1",
                "amount": 2999,
                "charge": "ch_1",
                "status": "succeeded",
            })
        )
        result = await connector._create_refund({
            "charge_id": "ch_1",
            "reason": "requested_by_customer",
        })
        assert result["id"] == "re_1"
        assert result["status"] == "succeeded"


class TestGetRevenue:

    @respx.mock
    async def test_revenue_report(self, connector):
        respx.get(url__startswith=f"{STRIPE_API}/charges").mock(
            return_value=Response(200, json={
                "data": [
                    {"amount": 2999, "paid": True, "amount_refunded": 0, "balance_transaction": {"fee": 87}},
                    {"amount": 1999, "paid": True, "amount_refunded": 500, "balance_transaction": {"fee": 58}},
                ],
                "has_more": False,
            })
        )
        result = await connector._get_revenue({"days": 7})
        assert result["total_revenue_cents"] == 4998
        assert result["total_refunded_cents"] == 500
        assert result["net_revenue_cents"] == 4498
        assert result["total_fees_cents"] == 145
        assert result["charge_count"] == 2
