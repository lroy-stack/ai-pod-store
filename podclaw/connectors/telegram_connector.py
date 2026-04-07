"""
PodClaw — Telegram MCP Connector
===================================

Send messages via Telegram Bot API.
Used by customer_manager and marketing agents.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

TELEGRAM_API = "https://api.telegram.org"


class TelegramMCPConnector:
    """In-process MCP connector for Telegram Bot API."""

    def __init__(self, bot_token: str):
        self._token = bot_token
        self._base = f"{TELEGRAM_API}/bot{bot_token}"

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "telegram_send": {
                "description": "Send a text message to a Telegram chat",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chat_id": {"type": ["string", "integer"], "description": "Telegram chat ID"},
                        "text": {"type": "string", "description": "Message text (Markdown supported)"},
                        "parse_mode": {
                            "type": "string",
                            "enum": ["Markdown", "MarkdownV2", "HTML"],
                            "description": "Message parse mode (default: Markdown)",
                        },
                    },
                    "required": ["chat_id", "text"],
                },
                "handler": self._send_message,
            },
            "telegram_send_photo": {
                "description": "Send a photo to a Telegram chat",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chat_id": {"type": ["string", "integer"], "description": "Telegram chat ID"},
                        "photo": {"type": "string", "description": "Photo URL"},
                        "caption": {"type": "string", "description": "Photo caption"},
                    },
                    "required": ["chat_id", "photo"],
                },
                "handler": self._send_photo,
            },
            "telegram_send_inline_keyboard": {
                "description": "Send a message with inline keyboard buttons to a Telegram chat",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chat_id": {"type": ["string", "integer"], "description": "Telegram chat ID"},
                        "text": {"type": "string", "description": "Message text"},
                        "buttons": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {"type": "string", "description": "Button label"},
                                    "callback_data": {"type": "string", "description": "Callback data (e.g. approve_123)"},
                                },
                                "required": ["text", "callback_data"],
                            },
                            "description": "List of inline keyboard buttons",
                        },
                        "parse_mode": {"type": "string", "enum": ["Markdown", "MarkdownV2", "HTML"]},
                    },
                    "required": ["chat_id", "text", "buttons"],
                },
                "handler": self._send_inline_keyboard,
            },
            "telegram_broadcast": {
                "description": "Send a message to multiple Telegram chats",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chat_ids": {
                            "type": "array",
                            "items": {"type": ["string", "integer"]},
                            "description": "List of chat IDs",
                        },
                        "text": {"type": "string", "description": "Message text"},
                        "parse_mode": {"type": "string", "enum": ["Markdown", "MarkdownV2", "HTML"]},
                    },
                    "required": ["chat_ids", "text"],
                },
                "handler": self._broadcast,
            },
        }

    async def _send_message(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "chat_id": params["chat_id"],
            "text": params["text"],
            "parse_mode": params.get("parse_mode", "Markdown"),
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self._base}/sendMessage", json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            return {"ok": data.get("ok", False), "message_id": data.get("result", {}).get("message_id")}

    async def _send_photo(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "chat_id": params["chat_id"],
            "photo": params["photo"],
        }
        if params.get("caption"):
            payload["caption"] = params["caption"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self._base}/sendPhoto", json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            return {"ok": data.get("ok", False), "message_id": data.get("result", {}).get("message_id")}

    async def _send_inline_keyboard(self, params: dict[str, Any]) -> dict[str, Any]:
        import json
        inline_buttons = [
            [{"text": btn["text"], "callback_data": btn["callback_data"]}]
            for btn in params["buttons"]
        ]
        payload = {
            "chat_id": params["chat_id"],
            "text": params["text"],
            "parse_mode": params.get("parse_mode", "Markdown"),
            "reply_markup": json.dumps({"inline_keyboard": inline_buttons}),
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self._base}/sendMessage", json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            return {"ok": data.get("ok", False), "message_id": data.get("result", {}).get("message_id")}

    async def _broadcast(self, params: dict[str, Any]) -> dict[str, Any]:
        chat_ids = params["chat_ids"]
        text = params["text"]
        parse_mode = params.get("parse_mode", "Markdown")

        sent = 0
        failed = 0
        async with httpx.AsyncClient() as client:
            for chat_id in chat_ids:
                try:
                    resp = await client.post(
                        f"{self._base}/sendMessage",
                        json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
                        timeout=15,
                    )
                    resp.raise_for_status()
                    sent += 1
                except Exception:
                    failed += 1

        return {"sent": sent, "failed": failed, "total": len(chat_ids)}
