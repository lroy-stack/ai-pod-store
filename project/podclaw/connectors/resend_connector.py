"""
PodClaw — Resend MCP Connector
=================================

Transactional and marketing email via Resend API.
Used by customer_manager, marketing, and newsletter agents.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

RESEND_API = "https://api.resend.com"


class ResendMCPConnector:
    """In-process MCP connector for Resend email."""

    def __init__(self, api_key: str, from_email: str):
        self._key = api_key
        self._from = from_email
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "resend_send": {
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
            "resend_get_bounce_stats": {
                "description": "Get email bounce and delivery statistics",
                "input_schema": {"type": "object", "properties": {}},
                "handler": self._get_bounce_stats,
            },
        }

    async def _send(self, params: dict[str, Any]) -> dict[str, Any]:
        body = {
            "from": self._from,
            "to": params["to"] if isinstance(params["to"], list) else [params["to"]],
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

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{RESEND_API}/emails", headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()

    async def _send_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        emails = []
        for e in params["emails"][:100]:  # Max 100 per batch
            emails.append({
                "from": self._from,
                "to": [e["to"]] if isinstance(e["to"], str) else e["to"],
                "subject": e["subject"],
                "html": e.get("html", ""),
            })

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{RESEND_API}/emails/batch", headers=self._headers, json=emails)
            resp.raise_for_status()
            return {"sent": len(emails), "response": resp.json()}

    async def _list_emails(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{RESEND_API}/emails"
        if params.get("tag"):
            url += f"?tag={params['tag']}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            data = resp.json()
            return {"emails": data.get("data", []) if isinstance(data, dict) else data}

    async def _get_bounce_stats(self, params: dict[str, Any]) -> dict[str, Any]:
        # Resend doesn't have a direct bounce stats endpoint — aggregate from email list
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{RESEND_API}/emails", headers=self._headers)
            resp.raise_for_status()
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
