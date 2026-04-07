# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Response Sender (backward-compat shim)
===================================================

Delegates to Notifier for channel-aware formatting.
Preserves the same API so existing imports work without changes.
"""

from __future__ import annotations

from typing import Any

import structlog

from podclaw.gateway.models import Platform
from podclaw.notifier import Notifier

logger = structlog.get_logger(__name__)


class Responder:
    """Backward-compatible shim — delegates to Notifier."""

    def __init__(self, whatsapp_connector: Any, telegram_connector: Any):
        self._wa = whatsapp_connector
        self._tg = telegram_connector
        self._notifier = Notifier(whatsapp_connector, telegram_connector)

    @property
    def notifier(self) -> Notifier:
        """Expose the underlying Notifier for direct access."""
        return self._notifier

    async def send_to_ceo(
        self,
        platform: Platform,
        text: str,
        image_url: str | None = None,
    ) -> None:
        """Send a response to the CEO via the appropriate platform."""
        channel = platform.value
        await self._notifier.notify_ceo(text, channel=channel, image_url=image_url)
