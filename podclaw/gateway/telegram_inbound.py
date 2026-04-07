"""
PodClaw — Telegram Inbound Webhook Handler
=============================================

Receives updates from Telegram Bot API, verifies secret token,
checks CEO identity, and normalizes to NormalizedMessage.

Security model:
  - Secret token verification: fail-closed (403 if invalid/missing)
  - CEO identity check: fail-closed (silently ignore non-CEO messages)
"""

from __future__ import annotations

from typing import Any, Callable, Awaitable

from fastapi import HTTPException, Request

import structlog

from podclaw import config
from podclaw.gateway.models import MessageType, NormalizedMessage, Platform

logger = structlog.get_logger(__name__)


def _is_ceo(chat_id: int | str) -> bool:
    """Check if the sender is the CEO (whitelist)."""
    ceo_id = config.CEO_TELEGRAM_CHAT_ID
    if not ceo_id:
        return False
    return str(chat_id) == str(ceo_id)


def _extract_chat_id(update: dict) -> int | None:
    """Extract chat_id from a Telegram update."""
    # Regular message
    message = update.get("message", {})
    if message:
        return message.get("chat", {}).get("id")
    # Callback query (inline button press)
    callback = update.get("callback_query", {})
    if callback:
        return callback.get("message", {}).get("chat", {}).get("id")
    return None


def normalize_telegram_update(update: dict) -> NormalizedMessage | None:
    """Convert a raw Telegram update to NormalizedMessage."""
    chat_id = _extract_chat_id(update)
    if chat_id is None:
        return None

    sender_id = str(chat_id)
    is_ceo = _is_ceo(chat_id)

    # Callback query (inline button press)
    callback = update.get("callback_query")
    if callback:
        return NormalizedMessage.create(
            platform=Platform.TELEGRAM,
            sender_id=sender_id,
            is_ceo=is_ceo,
            msg_type=MessageType.BUTTON_RESPONSE,
            button_payload=callback.get("data", ""),
            text=callback.get("data", ""),
        )

    message = update.get("message", {})
    if not message:
        return None

    # Photo message
    photos = message.get("photo")
    if photos:
        # Telegram sends multiple sizes; take the largest (last)
        largest = photos[-1]
        file_id = largest.get("file_id", "")
        caption = message.get("caption", "")
        return NormalizedMessage.create(
            platform=Platform.TELEGRAM,
            sender_id=sender_id,
            is_ceo=is_ceo,
            msg_type=MessageType.IMAGE,
            text=caption or None,
            image_url=f"tg_file:{file_id}" if file_id else None,
        )

    # Text message
    text = message.get("text", "")
    if text:
        # Detect commands (/status, /run, etc.)
        msg_type = MessageType.COMMAND if text.startswith("/") else MessageType.TEXT
        return NormalizedMessage.create(
            platform=Platform.TELEGRAM,
            sender_id=sender_id,
            is_ceo=is_ceo,
            msg_type=msg_type,
            text=text,
        )

    return None


async def handle_telegram_inbound(
    request: Request,
    on_message: Callable[[NormalizedMessage], Awaitable[None]] | None = None,
) -> dict:
    """
    Handle inbound Telegram webhook update (POST).

    Returns 200 immediately (Telegram requirement), dispatches in background.
    """
    # 1. Verify secret token
    secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    expected = config.TELEGRAM_WEBHOOK_SECRET
    if not expected or secret_token != expected:
        logger.warning("telegram_invalid_secret_token")
        raise HTTPException(status_code=403, detail="Invalid secret token")

    # 2. Parse payload
    import json
    body = await request.body()
    try:
        update = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # 3. Normalize
    normalized = normalize_telegram_update(update)
    if not normalized:
        return {"status": "unsupported_update"}

    # 4. CEO check — fail-closed
    if not normalized.is_ceo:
        logger.warning(
            "telegram_non_ceo_message",
            sender=normalized.sender_id,
            type=normalized.type.value,
        )
        return {"status": "unauthorized"}

    # 5. Dedup check (monotonic update_id)
    update_id = update.get("update_id")
    if update_id is not None:
        try:
            from podclaw.redis_store import get_redis
            rds = get_redis()
            if rds:
                dedup_key = "dedup:tg:last_update_id"
                last_id = rds.get(dedup_key)
                if last_id and int(last_id) >= update_id:
                    logger.debug("telegram_dedup_skip", update_id=update_id)
                    return {"status": "duplicate"}
                rds.set(dedup_key, str(update_id))
        except Exception:
            pass  # Fail-open

    # 6. Record CEO activity for inactivity fallback
    from podclaw.router.fallback import record_ceo_activity
    await record_ceo_activity()

    # 7. Dispatch to event router (in background via FastAPI BackgroundTasks)
    if on_message:
        await on_message(normalized)

    logger.info(
        "telegram_ceo_message_received",
        type=normalized.type.value,
        text_len=len(normalized.text or ""),
    )
    return {"status": "ok"}
