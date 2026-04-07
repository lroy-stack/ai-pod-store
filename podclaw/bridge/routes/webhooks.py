# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Webhook endpoints: WhatsApp, Telegram, Stripe, Printful, Email inbound.

None of these use require_auth — each has its own signature/secret verification.
"""

from __future__ import annotations

import hashlib
import hmac as _hmac
import json as _json
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

import structlog

from podclaw.bridge.deps import BridgeDeps, BridgeState

logger = structlog.get_logger(__name__)


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register webhook endpoints (no require_auth)."""

    async def _dispatch_message(normalized_message) -> None:
        """Background task: route normalized CEO message to event dispatcher."""
        if deps.event_dispatcher is None:
            logger.warning("webhook_no_dispatcher", msg_id=normalized_message.id)
            return
        try:
            await deps.event_dispatcher.dispatch(normalized_message)
        except Exception as e:
            logger.error(
                "webhook_dispatch_failed",
                msg_id=normalized_message.id,
                error=str(e),
            )

    # ----- WhatsApp -----

    @app.get("/webhooks/whatsapp")
    async def whatsapp_webhook_verify(request: Request):
        """Meta WhatsApp webhook verification (hub.challenge)."""
        from podclaw.gateway.whatsapp_inbound import handle_whatsapp_verify
        return await handle_whatsapp_verify(request)

    @app.post("/webhooks/whatsapp")
    async def whatsapp_webhook_inbound(request: Request, background_tasks: BackgroundTasks):
        """Inbound WhatsApp messages from CEO."""
        from podclaw.gateway.whatsapp_inbound import handle_whatsapp_inbound

        async def _on_message(msg):
            background_tasks.add_task(_dispatch_message, msg)

        return await handle_whatsapp_inbound(request, on_message=_on_message)

    # ----- Telegram -----

    @app.post("/webhooks/telegram")
    async def telegram_webhook_inbound(request: Request, background_tasks: BackgroundTasks):
        """Inbound Telegram updates from CEO."""
        from podclaw.gateway.telegram_inbound import handle_telegram_inbound

        async def _on_message(msg):
            await _dispatch_message(msg)

        return await handle_telegram_inbound(request, on_message=_on_message)

    # ----- Stripe -----

    @app.post("/webhooks/stripe")
    async def stripe_webhook_inbound(request: Request):
        """Receive Stripe webhook events (payments, disputes, refunds)."""
        from podclaw.config import STRIPE_WEBHOOK_SECRET

        if not STRIPE_WEBHOOK_SECRET:
            raise HTTPException(status_code=503, detail="Stripe webhook secret not configured")

        body = await request.body()
        sig_header = request.headers.get("stripe-signature", "")
        if not sig_header:
            raise HTTPException(status_code=403, detail="Missing stripe-signature header")

        sig_parts: dict[str, str] = {}
        for part in sig_header.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                sig_parts[k.strip()] = v.strip()

        timestamp = sig_parts.get("t", "")
        received_sig = sig_parts.get("v1", "")
        if not timestamp or not received_sig:
            raise HTTPException(status_code=403, detail="Invalid stripe-signature format")

        signed_payload = f"{timestamp}.{body.decode('utf-8')}"
        expected_sig = _hmac.new(
            STRIPE_WEBHOOK_SECRET.encode(), signed_payload.encode(), hashlib.sha256
        ).hexdigest()

        if not _hmac.compare_digest(expected_sig, received_sig):
            logger.warning("stripe_webhook_invalid_signature")
            raise HTTPException(status_code=403, detail="Invalid signature")

        try:
            event = _json.loads(body)
        except _json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON")

        event_id = event.get("id", "")
        event_type = event.get("type", "")

        try:
            from podclaw.redis_store import get_redis
            rds = get_redis()
            if rds and event_id:
                dedup_key = f"dedup:stripe:{event_id}"
                if rds.get(dedup_key):
                    return {"status": "duplicate"}
                rds.set(dedup_key, "1", ex=72 * 3600)
        except Exception:
            pass

        urgent_types = {"charge.dispute.created", "charge.dispute.updated", "charge.failed", "payment_intent.payment_failed"}
        wake_mode = "now" if event_type in urgent_types else "next-heartbeat"

        if deps.event_queue:
            from podclaw.event_queue import SystemEvent
            sys_event = SystemEvent(
                source="stripe",
                event_type="webhook_stripe",
                payload={"type": event_type, "stripe_event_id": event_id, "data": event.get("data", {})},
                wake_mode=wake_mode,
            )
            await deps.event_queue.push(sys_event)
            logger.info("stripe_webhook_queued", type=event_type, wake_mode=wake_mode)

        return {"status": "ok"}

    # ----- Printful -----

    @app.post("/webhooks/printful")
    async def printful_webhook_inbound(request: Request):
        """Receive Printful webhook events (product/order updates)."""
        from podclaw.config import PRINTFUL_WEBHOOK_SECRET

        body = await request.body()

        if PRINTFUL_WEBHOOK_SECRET:
            sig_header = request.headers.get("X-Printful-Signature", "")
            expected_sig = _hmac.new(
                PRINTFUL_WEBHOOK_SECRET.encode(), body, hashlib.sha256
            ).hexdigest()
            if not _hmac.compare_digest(expected_sig, sig_header):
                logger.warning("printful_webhook_invalid_signature")
                raise HTTPException(status_code=403, detail="Invalid signature")

        try:
            event = _json.loads(body)
        except _json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON")

        event_type = event.get("type", "")
        delivery_id = event.get("id", event.get("delivery_id", ""))

        if delivery_id:
            try:
                from podclaw.redis_store import get_redis
                rds = get_redis()
                if rds:
                    dedup_key = f"dedup:printful:{delivery_id}"
                    if rds.get(dedup_key):
                        return {"status": "duplicate"}
                    rds.set(dedup_key, "1", ex=24 * 3600)
            except Exception:
                pass

        urgent_types = {"product_updated", "product_deleted", "order_failed"}
        wake_mode = "now" if event_type in urgent_types else "next-heartbeat"

        if deps.event_queue:
            from podclaw.event_queue import SystemEvent
            sys_event = SystemEvent(
                source="printful",
                event_type="webhook_printful",
                payload={"type": event_type, "data": event.get("data", event)},
                wake_mode=wake_mode,
            )
            await deps.event_queue.push(sys_event)
            logger.info("printful_webhook_queued", type=event_type, wake_mode=wake_mode)

        return {"status": "ok"}

    # ----- Email Inbound -----

    @app.post("/webhooks/email/inbound")
    async def email_inbound_webhook(request: Request):
        """Receive inbound emails via Cloudflare Email Worker or Resend webhook."""
        body = await request.body()
        headers_dict = dict(request.headers)

        worker_secret = headers_dict.get("x-email-worker-secret", "")
        if worker_secret:
            from podclaw.config import EMAIL_WORKER_SECRET
            if not EMAIL_WORKER_SECRET or worker_secret != EMAIL_WORKER_SECRET:
                logger.warning("email_webhook_invalid_worker_secret")
                raise HTTPException(status_code=403, detail="Invalid worker secret")
            payload = _json.loads(body)
        else:
            from podclaw.config import RESEND_WEBHOOK_SECRET
            if not RESEND_WEBHOOK_SECRET:
                raise HTTPException(status_code=403, detail="No valid authentication")
            try:
                from svix.webhooks import Webhook
                wh = Webhook(RESEND_WEBHOOK_SECRET)
                payload = wh.verify(body, headers_dict)
            except Exception as e:
                logger.warning("email_webhook_invalid_signature", error=str(e))
                raise HTTPException(status_code=403, detail="Invalid webhook signature")

        event_type = payload.get("type", "")
        data = payload.get("data", payload)

        if event_type not in ("email.received", ""):
            logger.debug("email_webhook_ignored", type=event_type)
            return {"status": "ignored", "type": event_type}

        sender = data.get("from", "")
        to_addr = data.get("to", "")
        subject = data.get("subject", "")
        text_body = data.get("text", "")
        html_body = data.get("html", "")
        message_id = data.get("message_id", data.get("id", ""))

        if not sender:
            raise HTTPException(status_code=400, detail="Missing sender (from) field")

        if message_id:
            try:
                from podclaw.redis_store import get_redis
                rds = get_redis()
                if rds:
                    dedup_key = f"dedup:email:{message_id}"
                    existing = await rds.get(dedup_key)
                    if existing:
                        return {"status": "duplicate"}
                    await rds.set(dedup_key, "1", ex=72 * 3600)
            except Exception:
                pass

        body_preview = (text_body or html_body or "")[:2000]
        task_text = (
            f"Inbound email from {sender}\n"
            f"To: {to_addr}\n"
            f"Subject: {subject}\n"
            f"Body:\n{body_preview}"
        )

        if deps.event_queue:
            from podclaw.event_queue import SystemEvent
            sys_event = SystemEvent(
                source="email_worker",
                event_type="email_inbound",
                payload={
                    "task": task_text,
                    "from": sender,
                    "to": to_addr,
                    "subject": subject,
                    "text": text_body[:3000],
                    "message_id": message_id,
                },
                created_at=datetime.now(timezone.utc),
                wake_mode="now",
                target_agent="customer_support",
            )
            await deps.event_queue.push(sys_event)
            logger.info("email_inbound_queued", sender=sender, subject=subject[:80])

        return {"status": "ok"}
