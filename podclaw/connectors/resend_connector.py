"""
PodClaw — Resend MCP Connector
=================================

Transactional and marketing email via Resend API.
Used by customer_support, marketing, and finance agents.
"""

from __future__ import annotations

import re
from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import CircuitBreaker, RateLimiter, _err

logger = structlog.get_logger(__name__)

RESEND_API = "https://api.resend.com"

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _validate_email(email: str) -> None:
    """Validate email format. Raises ValueError if invalid."""
    if not _EMAIL_RE.match(email):
        raise ValueError(f"Invalid email format: {email[:50]}")


class ResendMCPConnector:
    """In-process MCP connector for Resend email."""

    def __init__(self, api_key: str, from_email: str):
        self._key = api_key
        self._from = from_email
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        self._circuit_breaker = CircuitBreaker(name="resend", failure_threshold=5, timeout=60.0)
        self._rate_limiter = RateLimiter(60)  # 60 req/min non-batch

    def _sync_client(self, timeout: float = 30.0) -> httpx.Client:
        """Create a fresh sync httpx client.

        Sync avoids 'Stream closed' errors when SDK runs tools in a temporary
        asyncio.run() thread — the sync client has no event loop dependency.
        """
        return httpx.Client(
            headers=self._headers,
            timeout=timeout,
        )

    async def close(self) -> None:
        pass

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "resend_send_email": {
                "description": "Send an email via Resend",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": ["string", "array"], "description": "Recipient email(s)"},
                        "subject": {"type": "string"},
                        "html": {"type": "string", "description": "HTML body"},
                        "text": {"type": "string", "description": "Plain text fallback"},
                        "reply_to": {"type": "string"},
                        "tags": {"type": "array", "items": {"type": "object"}},
                    },
                    "required": ["to", "subject"],
                },
                "handler": self._send,
            },
            "resend_send_batch": {
                "description": "Send batch emails via Resend (up to 100 per call)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "emails": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "to": {"type": "string"},
                                    "subject": {"type": "string"},
                                    "html": {"type": "string"},
                                },
                            },
                        },
                    },
                    "required": ["emails"],
                },
                "handler": self._send_batch,
            },
            "resend_list_emails": {
                "description": "List sent emails with optional tag filter",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "tag": {"type": "string", "description": "Filter by tag name"},
                    },
                },
                "handler": self._list_emails,
            },
            "resend_get_delivery_stats": {
                "description": "Get email delivery and bounce statistics",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_delivery_stats,
            },
        }

    async def _send(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._circuit_breaker.can_attempt():
            return _err("Resend circuit breaker open")
        recipients = params["to"] if isinstance(params["to"], list) else [params["to"]]
        try:
            for r in recipients:
                _validate_email(r)
        except ValueError as e:
            return _err(str(e))

        body: dict[str, Any] = {
            "from": self._from,
            "to": recipients,
            "subject": params["subject"],
        }
        if params.get("html"):
            body["html"] = params["html"]
        if params.get("text"):
            body["text"] = params["text"]
        if params.get("reply_to"):
            body["reply_to"] = params["reply_to"]
        if params.get("tags"):
            body["tags"] = params["tags"]

        await self._rate_limiter.acquire()
        try:
            with self._sync_client() as client:
                resp = client.post(f"{RESEND_API}/emails", json=body)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                return resp.json()
        except Exception as e:
            self._circuit_breaker.record_failure()
            logger.error("resend_send_failed", error=str(e), to=recipients)
            return _err(f"Send email failed: {e}")

    async def _send_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        emails = []
        for e in params["emails"][:100]:  # Max 100 per batch
            try:
                to = [e["to"]] if isinstance(e["to"], str) else e["to"]
                for r in to:
                    _validate_email(r)
            except ValueError as ve:
                return _err(str(ve))
            emails.append({
                "from": self._from,
                "to": to,
                "subject": e["subject"],
                "html": e.get("html", ""),
            })

        try:
            with self._sync_client() as client:
                resp = client.post(f"{RESEND_API}/emails/batch", json=emails)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                return {"sent": len(emails), "response": resp.json()}
        except Exception as e:
            self._circuit_breaker.record_failure()
            logger.error("resend_batch_failed", error=str(e))
            return _err(f"Batch send failed: {e}")

    async def _list_emails(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{RESEND_API}/emails"
        if params.get("tag"):
            url += f"?tag={params['tag']}"
        try:
            with self._sync_client() as client:
                resp = client.get(url)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                data = resp.json()
                return {"emails": data.get("data", []) if isinstance(data, dict) else data}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"List emails failed: {e}")

    async def _get_delivery_stats(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            with self._sync_client() as client:
                resp = client.get(f"{RESEND_API}/emails")
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                data = resp.json()
            emails = data.get("data", []) if isinstance(data, dict) else data
            total = len(emails)
            bounced = sum(1 for e in emails if e.get("last_event") == "bounced")
            delivered = sum(1 for e in emails if e.get("last_event") == "delivered")
            opened = sum(1 for e in emails if e.get("last_event") == "opened")
            clicked = sum(1 for e in emails if e.get("last_event") == "clicked")
            return {
                "total": total,
                "delivered": delivered,
                "bounced": bounced,
                "opened": opened,
                "clicked": clicked,
                "bounce_rate": round(bounced / total * 100, 2) if total > 0 else 0,
            }
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Get delivery stats failed: {e}")
