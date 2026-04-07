"""
PodClaw — Gateway Message Models
===================================

Normalized message format for CEO communication across platforms.
All inbound messages (WhatsApp, Telegram, Bridge) are converted to
NormalizedMessage before routing to the event classifier.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class Platform(Enum):
    """Communication platform for CEO messages."""
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    BRIDGE = "bridge"  # Local terminal / admin API


class MessageType(Enum):
    """Type of inbound message."""
    TEXT = "text"
    IMAGE = "image"
    BUTTON_RESPONSE = "button_response"
    COMMAND = "command"


@dataclass
class NormalizedMessage:
    """Platform-agnostic representation of a CEO message."""
    id: str
    platform: Platform
    sender_id: str  # phone number or chat_id
    is_ceo: bool  # verified against whitelist
    type: MessageType
    text: Optional[str] = None
    image_url: Optional[str] = None
    button_payload: Optional[str] = None  # e.g. "approve:design_123"
    reply_to: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @staticmethod
    def create(
        platform: Platform,
        sender_id: str,
        is_ceo: bool,
        msg_type: MessageType,
        **kwargs,
    ) -> "NormalizedMessage":
        """Factory method with auto-generated ID and timestamp."""
        return NormalizedMessage(
            id=str(uuid.uuid4()),
            platform=platform,
            sender_id=sender_id,
            is_ceo=is_ceo,
            type=msg_type,
            **kwargs,
        )


@dataclass
class NormalizedEvent:
    """Canonical event format for non-CEO events (webhooks, system alerts).

    Complements NormalizedMessage (CEO messages) for pipeline-aware routing.
    """

    id: str
    source: str  # "whatsapp" | "telegram" | "stripe" | "printful" | "bridge"
    event_type: str  # "ceo_message" | "webhook_stripe" | "webhook_printful" | "system_alert"
    channel: str  # response channel
    payload: dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    sender_id: Optional[str] = None

    @staticmethod
    def from_message(msg: "NormalizedMessage") -> "NormalizedEvent":
        """Bridge a NormalizedMessage to NormalizedEvent."""
        return NormalizedEvent(
            id=msg.id,
            source=msg.platform.value,
            event_type="ceo_message",
            channel=msg.platform.value,
            payload={
                "text": msg.text,
                "image_url": msg.image_url,
                "button_payload": msg.button_payload,
            },
            timestamp=msg.timestamp,
            sender_id=msg.sender_id,
        )

    @staticmethod
    def create(
        source: str,
        event_type: str,
        channel: str,
        payload: dict | None = None,
        sender_id: str | None = None,
    ) -> "NormalizedEvent":
        """Factory method with auto-generated ID and timestamp."""
        return NormalizedEvent(
            id=str(uuid.uuid4()),
            source=source,
            event_type=event_type,
            channel=channel,
            payload=payload or {},
            sender_id=sender_id,
        )
