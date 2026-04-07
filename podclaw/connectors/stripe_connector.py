"""
PodClaw — Stripe MCP Connector
=================================

7 tools: read access + approved refunds for finance and customer_support agents.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import CircuitBreaker, validate_stripe_id, _err

logger = structlog.get_logger(__name__)

STRIPE_API = "https://api.stripe.com/v1"


class StripeMCPConnector:
    """In-process MCP connector for Stripe."""

    def __init__(self, secret_key: str):
        self._key = secret_key
        self._headers = {"Authorization": f"Bearer {secret_key}"}
        self._circuit_breaker = CircuitBreaker(name="stripe", failure_threshold=5, timeout=60.0)

    def _new_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        """Fresh client per request. Use as: async with self._new_client() as c:"""
        return httpx.AsyncClient(
            headers=self._headers,
            timeout=timeout,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    async def close(self) -> None:
        pass

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "stripe_list_charges": {
                "description": "List recent Stripe charges/payments",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Max results (default 25)"},
                        "created_after": {"type": "string", "description": "ISO timestamp filter"},
                    },
                },
                "handler": self._list_charges,
            },
            "stripe_get_balance": {
                "description": "Get current Stripe account balance",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_balance,
            },
            "stripe_get_revenue_report": {
                "description": "Get revenue summary for a date range",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "days": {"type": "integer", "description": "Number of days to look back (default 7)"},
                    },
                },
                "handler": self._get_revenue,
            },
            "stripe_create_refund": {
                "description": "Create a refund for a charge (requires approval for > EUR 25)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "charge_id": {"type": "string"},
                        "amount": {"type": "integer", "description": "Amount in cents (omit for full refund)"},
                        "reason": {"type": "string", "enum": ["duplicate", "fraudulent", "requested_by_customer"]},
                    },
                    "required": ["charge_id"],
                },
                "handler": self._create_refund,
            },
            "stripe_list_disputes": {
                "description": "List recent Stripe disputes",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Max results (default 10)"},
                    },
                },
                "handler": self._list_disputes,
            },
            "stripe_get_invoice": {
                "description": "Get a specific Stripe invoice by ID",
                "input_schema": {
                    "type": "object",
                    "properties": {"invoice_id": {"type": "string"}},
                    "required": ["invoice_id"],
                },
                "handler": self._get_invoice,
            },
            "stripe_list_payouts": {
                "description": "List recent Stripe payouts",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Max results (default 10)"},
                        "status": {"type": "string", "enum": ["paid", "pending", "in_transit", "canceled", "failed"]},
                    },
                },
                "handler": self._list_payouts,
            },
        }

    async def _list_charges(self, params: dict[str, Any]) -> dict[str, Any]:
        limit = params.get("limit", 25)
        url = f"{STRIPE_API}/charges?limit={limit}"

        if params.get("created_after"):
            import datetime
            dt = datetime.datetime.fromisoformat(params["created_after"])
            url += f"&created[gte]={int(dt.timestamp())}"

        try:
            async with self._new_client() as client:
                resp = await client.get(url)
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            data = resp.json()
            return {"charges": data.get("data", []), "has_more": data.get("has_more", False)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"List charges failed: {e}")

    async def _get_balance(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            async with self._new_client() as client:
                resp = await client.get(f"{STRIPE_API}/balance")
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            return resp.json()
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Get balance failed: {e}")

    async def _get_revenue(self, params: dict[str, Any]) -> dict[str, Any]:
        import datetime
        days = params.get("days", 7)
        since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)

        charges = await self._list_charges({"limit": 100, "created_after": since.isoformat()})
        if "error" in charges:
            return charges

        total_revenue = sum(c.get("amount", 0) for c in charges.get("charges", []) if c.get("paid"))
        total_refunded = sum(c.get("amount_refunded", 0) for c in charges.get("charges", []))
        total_fees = sum(
            c.get("balance_transaction", {}).get("fee", 0)
            for c in charges.get("charges", [])
            if isinstance(c.get("balance_transaction"), dict)
        )

        return {
            "period_days": days,
            "total_revenue_cents": total_revenue,
            "total_refunded_cents": total_refunded,
            "net_revenue_cents": total_revenue - total_refunded,
            "total_fees_cents": total_fees,
            "charge_count": len(charges.get("charges", [])),
        }

    async def _create_refund(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            validate_stripe_id(params["charge_id"], "charge_id")
        except ValueError as e:
            return _err(str(e))

        data = {"charge": params["charge_id"]}
        if params.get("amount"):
            data["amount"] = params["amount"]
        if params.get("reason"):
            data["reason"] = params["reason"]

        try:
            async with self._new_client() as client:
                resp = await client.post(f"{STRIPE_API}/refunds", data=data)
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            return resp.json()
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Create refund failed: {e}")

    async def _list_disputes(self, params: dict[str, Any]) -> dict[str, Any]:
        limit = params.get("limit", 10)
        try:
            async with self._new_client() as client:
                resp = await client.get(f"{STRIPE_API}/disputes?limit={limit}")
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            data = resp.json()
            return {"disputes": data.get("data", []), "has_more": data.get("has_more", False)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"List disputes failed: {e}")

    async def _get_invoice(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            validate_stripe_id(params["invoice_id"], "invoice_id")
        except ValueError as e:
            return _err(str(e))

        try:
            async with self._new_client() as client:
                resp = await client.get(f"{STRIPE_API}/invoices/{params['invoice_id']}")
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            return resp.json()
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Get invoice failed: {e}")

    async def _list_payouts(self, params: dict[str, Any]) -> dict[str, Any]:
        limit = params.get("limit", 10)
        url = f"{STRIPE_API}/payouts?limit={limit}"
        if params.get("status"):
            url += f"&status={params['status']}"
        try:
            async with self._new_client() as client:
                resp = await client.get(url)
            resp.raise_for_status()
            self._circuit_breaker.record_success()
            data = resp.json()
            return {"payouts": data.get("data", []), "has_more": data.get("has_more", False)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"List payouts failed: {e}")
