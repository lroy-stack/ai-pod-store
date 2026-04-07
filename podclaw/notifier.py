# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Notifier (Phase 4)
===============================

Channel-aware output formatting for CEO notifications.
Replaces the thin Responder with rich formatting per platform:
- WhatsApp: plain text, 4096 limit, smart truncation
- Telegram: Markdown, inline keyboard support
- Bridge/Admin: JSON, no limit

Reuses existing WhatsApp/Telegram connector get_tools() pattern.
Fail-silent: never blocks agent work on notification errors.
"""

from __future__ import annotations

from typing import Any

import structlog

from podclaw import config
from podclaw.gateway.models import Platform

logger = structlog.get_logger(__name__)

# Platform character limits
_WA_LIMIT = 4096
_TG_LIMIT = 4096
_TRUNCATION_SUFFIX = "\n\n[Truncado]"


class Notifier:
    """Channel-aware notification system for CEO communication."""

    def __init__(self, whatsapp_connector: Any, telegram_connector: Any):
        self._wa = whatsapp_connector
        self._tg = telegram_connector

    async def notify_ceo(
        self,
        text: str,
        channel: str = "telegram",
        severity: str = "INFO",
        image_url: str | None = None,
    ) -> None:
        """Send notification to CEO.

        severity="CRITICAL" sends to ALL channels.
        severity="INFO" sends to originating channel only.
        """
        if severity == "CRITICAL":
            # Send to all available channels
            await self._send_to_channel("whatsapp", text, image_url)
            await self._send_to_channel("telegram", text, image_url)
        else:
            await self._send_to_channel(channel, text, image_url)

    async def send_progress(
        self,
        step: str,
        result: str,
        step_index: int,
        total_steps: int,
        channel: str = "telegram",
    ) -> None:
        """Send pipeline progress update to CEO."""
        progress_bar = f"[{step_index + 1}/{total_steps}]"
        text = f"{progress_bar} Step: {step}\n\nResult:\n{result}"
        formatted = self._format(channel, text, "progress")
        await self._send_to_channel(channel, formatted)

    async def request_approval(
        self,
        resource_type: str,
        resource_id: str,
        preview_text: str,
        channel: str = "telegram",
        preview_image_url: str | None = None,
    ) -> None:
        """Send approval request with buttons."""
        approve_payload = f"approve_{resource_type}_{resource_id}"
        reject_payload = f"reject_{resource_type}_{resource_id}"

        buttons = [
            {"text": "Aprobar", "payload": approve_payload},
            {"text": "Rechazar", "payload": reject_payload},
        ]

        if channel == "whatsapp":
            await self._send_buttons_whatsapp(preview_text, buttons, preview_image_url)
        elif channel == "telegram":
            await self._send_buttons_telegram(preview_text, buttons, preview_image_url)
        else:
            logger.info("approval_request_bridge", resource=f"{resource_type}:{resource_id}")

    async def send_agent_result(
        self,
        agent_name: str,
        result: dict[str, Any],
        channel: str = "telegram",
    ) -> None:
        """Format and send agent execution result to CEO."""
        response = result.get("response", "")
        status = result.get("status", "unknown")
        cost = result.get("total_cost_usd", 0)
        tools = result.get("tool_calls", 0)

        if not response:
            text = f"Agent {agent_name}: {status} ({tools} tools, ${cost:.3f})"
        else:
            header = f"Agent: {agent_name} | {tools} tools | ${cost:.3f}"
            text = f"{header}\n\n{response}"

        formatted = self._format(channel, text, "result")
        await self._send_to_channel(channel, formatted)

    async def send_error(
        self,
        context: str,
        error: str,
        channel: str = "telegram",
    ) -> None:
        """Send error notification to CEO."""
        text = f"Error in {context}:\n{error}"
        formatted = self._format(channel, text, "error")
        await self._send_to_channel(channel, formatted)

    # -----------------------------------------------------------------------
    # Formatting
    # -----------------------------------------------------------------------

    def _format(self, channel: str, text: str, msg_type: str = "info") -> str:
        """Route to channel-specific formatter."""
        if channel == "whatsapp":
            return self._format_for_whatsapp(text, msg_type)
        if channel == "telegram":
            return self._format_for_telegram(text, msg_type)
        return text  # bridge: no formatting

    @staticmethod
    def _format_for_whatsapp(text: str, msg_type: str) -> str:
        """Plain text, 4096 limit, smart truncation."""
        # WhatsApp uses *bold* and _italic_ (same as markdown basics)
        return _truncate(text, _WA_LIMIT)

    @staticmethod
    def _format_for_telegram(text: str, msg_type: str) -> str:
        """Markdown formatting for Telegram."""
        return _truncate(text, _TG_LIMIT)

    # -----------------------------------------------------------------------
    # Button sending
    # -----------------------------------------------------------------------

    async def _send_buttons_whatsapp(
        self,
        body: str,
        buttons: list[dict],
        image_url: str | None = None,
    ) -> None:
        """Send WhatsApp interactive buttons via connector."""
        ceo_number = config.CEO_WHATSAPP_NUMBER
        if not ceo_number or not self._wa:
            return

        try:
            tools = self._wa.get_tools()
            send_fn = tools.get("whatsapp_send_buttons", {}).get("handler")
            if send_fn:
                await send_fn({
                    "to": ceo_number,
                    "body": _truncate(body, 1024),
                    "buttons": [{"id": b["payload"], "title": b["text"][:20]} for b in buttons[:3]],
                })
            else:
                # Fallback: send as plain text with options
                btn_text = "\n".join(f"- {b['text']}: reply '{b['payload']}'" for b in buttons)
                await tools["whatsapp_send"]["handler"]({
                    "to": ceo_number,
                    "text": f"{body}\n\n{btn_text}",
                })
        except Exception as e:
            logger.warning("notifier_wa_buttons_failed", error=str(e))

    async def _send_buttons_telegram(
        self,
        text: str,
        buttons: list[dict],
        image_url: str | None = None,
    ) -> None:
        """Send Telegram inline keyboard via connector."""
        chat_id = config.CEO_TELEGRAM_CHAT_ID
        if not chat_id or not self._tg:
            return

        try:
            tools = self._tg.get_tools()
            send_fn = tools.get("telegram_send_buttons", {}).get("handler")
            if send_fn:
                keyboard = [[{"text": b["text"], "callback_data": b["payload"]}] for b in buttons]
                await send_fn({
                    "chat_id": chat_id,
                    "text": _truncate(text, _TG_LIMIT),
                    "reply_markup": {"inline_keyboard": keyboard},
                })
            else:
                # Fallback: send as plain text
                await tools["telegram_send"]["handler"]({
                    "chat_id": chat_id,
                    "text": _truncate(text, _TG_LIMIT),
                })
        except Exception as e:
            logger.warning("notifier_tg_buttons_failed", error=str(e))

    # -----------------------------------------------------------------------
    # Channel dispatch
    # -----------------------------------------------------------------------

    async def _send_to_channel(
        self,
        channel: str,
        text: str,
        image_url: str | None = None,
    ) -> None:
        """Send text to a specific channel. Fail-silent."""
        try:
            if channel == "whatsapp":
                await self._send_whatsapp(text, image_url)
            elif channel == "telegram":
                await self._send_telegram(text, image_url)
            else:
                logger.info("notifier_bridge_response", text=text[:100])
        except Exception as e:
            logger.warning("notifier_send_failed", channel=channel, error=str(e))

    async def _send_whatsapp(self, text: str, image_url: str | None = None) -> None:
        """Send via WhatsApp connector tools."""
        if not self._wa:
            return
        tools = self._wa.get_tools()
        ceo_number = config.CEO_WHATSAPP_NUMBER
        if not ceo_number:
            return

        if image_url and "whatsapp_send_image" in tools:
            await tools["whatsapp_send_image"]["handler"]({
                "to": ceo_number,
                "image_url": image_url,
                "caption": _truncate(text, 1024),
            })
        else:
            await tools["whatsapp_send"]["handler"]({
                "to": ceo_number,
                "text": _truncate(text, _WA_LIMIT),
            })

    async def _send_telegram(self, text: str, image_url: str | None = None) -> None:
        """Send via Telegram connector tools."""
        if not self._tg:
            return
        tools = self._tg.get_tools()
        chat_id = config.CEO_TELEGRAM_CHAT_ID
        if not chat_id:
            return

        if image_url and "telegram_send_photo" in tools:
            await tools["telegram_send_photo"]["handler"]({
                "chat_id": chat_id,
                "photo": image_url,
                "caption": _truncate(text, 1024),
            })
        else:
            await tools["telegram_send"]["handler"]({
                "chat_id": chat_id,
                "text": _truncate(text, _TG_LIMIT),
            })


# ---------------------------------------------------------------------------
# Module-level helper
# ---------------------------------------------------------------------------


def _truncate(text: str, limit: int = 4096, suffix: str = _TRUNCATION_SUFFIX) -> str:
    """Smart truncation preserving paragraph structure."""
    if len(text) <= limit:
        return text

    cut = limit - len(suffix)
    # Try to cut at paragraph break
    last_para = text.rfind("\n\n", 0, cut)
    if last_para > cut * 0.5:
        return text[:last_para] + suffix

    # Try to cut at line break
    last_line = text.rfind("\n", 0, cut)
    if last_line > cut * 0.5:
        return text[:last_line] + suffix

    return text[:cut] + suffix
