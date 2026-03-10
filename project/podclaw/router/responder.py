"""
PodClaw — Response Sender
============================

Sends agent results back to the CEO via the same platform (WhatsApp or Telegram).
Reuses existing connector tools — does NOT create new HTTP clients.
"""

from __future__ import annotations

from typing import Any

import structlog

from podclaw import config
from podclaw.gateway.models import Platform

logger = structlog.get_logger(__name__)


class Responder:
    """Send responses back to the CEO via WhatsApp or Telegram connectors."""

    def __init__(self, whatsapp_connector: Any, telegram_connector: Any):
        self._wa = whatsapp_connector
        self._tg = telegram_connector

    async def send_to_ceo(
        self,
        platform: Platform,
        text: str,
        image_url: str | None = None,
    ) -> None:
        """Send a response to the CEO via the appropriate platform."""
        try:
            if platform == Platform.WHATSAPP:
                await self._send_whatsapp(text, image_url)
            elif platform == Platform.TELEGRAM:
                await self._send_telegram(text, image_url)
            else:
                logger.info("responder_bridge_response", text=text[:100])
        except Exception as e:
            logger.error(
                "responder_send_failed",
                platform=platform.value,
                error=str(e),
            )

    async def _send_whatsapp(self, text: str, image_url: str | None = None) -> None:
        """Send via WhatsApp connector tools."""
        tools = self._wa.get_tools()
        ceo_number = config.CEO_WHATSAPP_NUMBER
        if not ceo_number:
            logger.warning("responder_no_ceo_whatsapp_number")
            return

        if image_url and "whatsapp_send_image" in tools:
            await tools["whatsapp_send_image"]["handler"]({
                "to": ceo_number,
                "image_url": image_url,
                "caption": text[:1024],  # Caption limit
            })
        else:
            await tools["whatsapp_send"]["handler"]({
                "to": ceo_number,
                "text": text,
            })

    async def _send_telegram(self, text: str, image_url: str | None = None) -> None:
        """Send via Telegram connector tools."""
        tools = self._tg.get_tools()
        ceo_chat_id = config.CEO_TELEGRAM_CHAT_ID
        if not ceo_chat_id:
            logger.warning("responder_no_ceo_telegram_chat_id")
            return

        if image_url and "telegram_send_photo" in tools:
            await tools["telegram_send_photo"]["handler"]({
                "chat_id": ceo_chat_id,
                "photo": image_url,
                "caption": text[:1024],
            })
        else:
            await tools["telegram_send"]["handler"]({
                "chat_id": ceo_chat_id,
                "text": text,
            })
