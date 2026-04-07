"""
PodClaw — WhatsApp MCP Connector
===================================

Send messages via WhatsApp Cloud API (Meta Business Platform).
Used by customer_manager and marketing agents.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

WHATSAPP_API = "https://graph.facebook.com/v18.0"


class WhatsAppMCPConnector:
    """In-process MCP connector for WhatsApp Cloud API."""

    def __init__(self, phone_number_id: str, access_token: str):
        self._phone_id = phone_number_id
        self._token = access_token
        self._base = f"{WHATSAPP_API}/{phone_number_id}/messages"
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "whatsapp_send": {
                "description": "Send a text message via WhatsApp",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "description": "Recipient phone number (with country code, e.g. +34612345678)"},
                        "text": {"type": "string", "description": "Message text"},
                    },
                    "required": ["to", "text"],
                },
                "handler": self._send_text,
            },
            "whatsapp_send_template": {
                "description": "Send a pre-approved WhatsApp template message (for order updates, etc.)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "description": "Recipient phone number"},
                        "template_name": {"type": "string", "description": "Template name (e.g. order_confirmation)"},
                        "language_code": {"type": "string", "description": "Language code (default: en)"},
                        "parameters": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Template parameter values",
                        },
                    },
                    "required": ["to", "template_name"],
                },
                "handler": self._send_template,
            },
            "whatsapp_send_image": {
                "description": "Send an image with optional caption via WhatsApp",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "description": "Recipient phone number"},
                        "image_url": {"type": "string", "description": "Public URL of the image"},
                        "caption": {"type": "string", "description": "Image caption text"},
                    },
                    "required": ["to", "image_url"],
                },
                "handler": self._send_image,
            },
            "whatsapp_send_buttons": {
                "description": "Send an interactive message with up to 3 buttons via WhatsApp",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "description": "Recipient phone number"},
                        "body_text": {"type": "string", "description": "Message body text"},
                        "buttons": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string", "description": "Button callback ID (e.g. approve_123)"},
                                    "title": {"type": "string", "description": "Button label (max 20 chars)"},
                                },
                                "required": ["id", "title"],
                            },
                            "description": "List of buttons (max 3)",
                            "maxItems": 3,
                        },
                    },
                    "required": ["to", "body_text", "buttons"],
                },
                "handler": self._send_buttons,
            },
        }

    async def _send_text(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": params["to"],
            "type": "text",
            "text": {"body": params["text"]},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(self._base, headers=self._headers, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            msg_id = None
            if data.get("messages"):
                msg_id = data["messages"][0].get("id")
            return {"ok": True, "message_id": msg_id}

    async def _send_image(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": params["to"],
            "type": "image",
            "image": {"link": params["image_url"]},
        }
        if params.get("caption"):
            payload["image"]["caption"] = params["caption"]
        async with httpx.AsyncClient() as client:
            resp = await client.post(self._base, headers=self._headers, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            msg_id = None
            if data.get("messages"):
                msg_id = data["messages"][0].get("id")
            return {"ok": True, "message_id": msg_id}

    async def _send_buttons(self, params: dict[str, Any]) -> dict[str, Any]:
        buttons_payload = [
            {
                "type": "reply",
                "reply": {"id": btn["id"], "title": btn["title"][:20]},
            }
            for btn in params["buttons"][:3]
        ]
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": params["to"],
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": params["body_text"]},
                "action": {"buttons": buttons_payload},
            },
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(self._base, headers=self._headers, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            msg_id = None
            if data.get("messages"):
                msg_id = data["messages"][0].get("id")
            return {"ok": True, "message_id": msg_id}

    async def _send_template(self, params: dict[str, Any]) -> dict[str, Any]:
        components = []
        if params.get("parameters"):
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in params["parameters"]],
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": params["to"],
            "type": "template",
            "template": {
                "name": params["template_name"],
                "language": {"code": params.get("language_code", "en")},
                "components": components,
            },
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(self._base, headers=self._headers, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            msg_id = None
            if data.get("messages"):
                msg_id = data["messages"][0].get("id")
            return {"ok": True, "message_id": msg_id}
