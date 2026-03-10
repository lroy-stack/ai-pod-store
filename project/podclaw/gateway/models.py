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
