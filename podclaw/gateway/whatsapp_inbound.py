"""
PodClaw — WhatsApp Inbound Webhook Handler
=============================================

Receives messages from Meta WhatsApp Cloud API, verifies HMAC signature,
checks CEO identity, and normalizes to NormalizedMessage.

Security model:
  - HMAC-SHA256 verification: fail-closed (403 if invalid/missing)
  - CEO identity check: fail-closed (silently ignore non-CEO messages)
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any, Callable, Awaitable

from fastapi import HTTPException, Request, Response
from fastapi.responses import PlainTextResponse

import structlog

from podclaw import config
from podclaw.gateway.models import MessageType, NormalizedMessage, Platform

logger = structlog.get_logger(__name__)


def verify_whatsapp_signature(body: bytes, signature_header: str) -> bool:
    """Verify HMAC-SHA256 signature from Meta webhook."""
    app_secret = config.WHATSAPP_APP_SECRET
    if not app_secret:
        logger.error("whatsapp_app_secret_not_configured")
        return False

    expected = hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    actual = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, actual)


def _is_ceo(phone_number: str) -> bool:
    """Check if the sender is the CEO (whitelist)."""
    ceo_number = config.CEO_WHATSAPP_NUMBER
    if not ceo_number:
        return False
    # Normalize: strip + prefix for comparison
    normalized = phone_number.lstrip("+")
    ceo_normalized = ceo_number.lstrip("+")
    return normalized == ceo_normalized


def _extract_message(entry_data: dict) -> dict[str, Any] | None:
    """Extract the first message from a WhatsApp webhook payload."""
    try:
        changes = entry_data.get("entry", [{}])[0].get("changes", [{}])
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        if not messages:
            return None
        return messages[0]
    except (IndexError, KeyError, TypeError):
        return None


def normalize_whatsapp_message(raw_message: dict) -> NormalizedMessage | None:
    """Convert a raw WhatsApp message to NormalizedMessage."""
    sender = raw_message.get("from", "")
    msg_type_str = raw_message.get("type", "")
    is_ceo = _is_ceo(sender)

    if msg_type_str == "text":
        text_body = raw_message.get("text", {}).get("body", "")
        return NormalizedMessage.create(
            platform=Platform.WHATSAPP,
            sender_id=sender,
            is_ceo=is_ceo,
            msg_type=MessageType.TEXT,
            text=text_body,
        )

    if msg_type_str == "image":
        image_data = raw_message.get("image", {})
        caption = image_data.get("caption", "")
        # Media ID needs to be resolved via Graph API to get URL
        image_id = image_data.get("id", "")
        return NormalizedMessage.create(
            platform=Platform.WHATSAPP,
            sender_id=sender,
            is_ceo=is_ceo,
            msg_type=MessageType.IMAGE,
            text=caption or None,
            image_url=f"wa_media:{image_id}" if image_id else None,
        )

    if msg_type_str == "interactive":
        interactive = raw_message.get("interactive", {})
        interactive_type = interactive.get("type", "")
        if interactive_type == "button_reply":
            button = interactive.get("button_reply", {})
            return NormalizedMessage.create(
                platform=Platform.WHATSAPP,
                sender_id=sender,
                is_ceo=is_ceo,
                msg_type=MessageType.BUTTON_RESPONSE,
                button_payload=button.get("id", ""),
                text=button.get("title", ""),
            )

    logger.debug("whatsapp_unsupported_type", type=msg_type_str, sender=sender)
    return None


async def handle_whatsapp_verify(request: Request) -> Response:
    """Handle Meta webhook verification (GET request with hub.challenge)."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == config.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        logger.info("whatsapp_webhook_verified")
        return PlainTextResponse(content=challenge or "")

    logger.warning("whatsapp_webhook_verify_failed", mode=mode)
    raise HTTPException(status_code=403, detail="Verification failed")


async def handle_whatsapp_inbound(
    request: Request,
    on_message: Callable[[NormalizedMessage], Awaitable[None]] | None = None,
) -> dict:
    """
    Handle inbound WhatsApp message webhook (POST).

    Returns 200 immediately (Meta requirement), dispatches in background.
    """
    body = await request.body()

    # 1. Verify HMAC signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_whatsapp_signature(body, signature):
        logger.warning("whatsapp_invalid_signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # 2. Parse payload
    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # 3. Only process whatsapp_business_account events
    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    # 4. Extract and normalize message
    raw_message = _extract_message(payload)
    if not raw_message:
        return {"status": "no_message"}

    normalized = normalize_whatsapp_message(raw_message)
    if not normalized:
        return {"status": "unsupported_type"}

    # 5. CEO check — fail-closed
    if not normalized.is_ceo:
        logger.warning(
            "whatsapp_non_ceo_message",
            sender=normalized.sender_id,
            type=normalized.type.value,
        )
        return {"status": "unauthorized"}

    # 6. Dedup check (Redis SET with 5-min TTL)
    msg_id = raw_message.get("id", "")
    if msg_id:
        try:
            from podclaw.redis_store import get_redis
            rds = get_redis()
            if rds:
                dedup_key = f"dedup:wa:{msg_id}"
                if rds.get(dedup_key):
                    logger.debug("whatsapp_dedup_skip", msg_id=msg_id)
                    return {"status": "duplicate"}
                rds.set(dedup_key, "1", ex=300)  # 5 minutes
        except Exception:
            pass  # Fail-open

    # 7. Record CEO activity for inactivity fallback
    from podclaw.router.fallback import record_ceo_activity
    await record_ceo_activity()

    # 8. Dispatch to event router (in background via FastAPI BackgroundTasks)
    if on_message:
        await on_message(normalized)

    logger.info(
        "whatsapp_ceo_message_received",
        type=normalized.type.value,
        text_len=len(normalized.text or ""),
    )
    return {"status": "ok"}
