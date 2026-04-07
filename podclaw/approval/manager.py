"""
PodClaw — Approval Manager
==============================

Manages CEO approval workflow for designs, products, refunds, newsletters.
Sends preview messages with approve/reject buttons and handles responses.
"""

from __future__ import annotations

import re
import uuid
from typing import TYPE_CHECKING, Any

import structlog

from podclaw import config
from podclaw.gateway.models import NormalizedMessage, Platform

if TYPE_CHECKING:
    from podclaw.core import Orchestrator
    from podclaw.router.responder import Responder

logger = structlog.get_logger(__name__)

# Regex to parse button payloads: approve_design_<uuid> or reject_product_<uuid>
_PAYLOAD_RE = re.compile(r"^(approve|reject)_(\w+)_([0-9a-f\-]{36})$")

# Actions to trigger after approval by resource type
_POST_APPROVAL_AGENTS: dict[str, str] = {
    "design": "cataloger",       # Approved design → publish product
    "product": "cataloger",      # Approved product update → apply
    "newsletter": "newsletter",  # Approved newsletter → send
}


class ApprovalManager:
    """Manage CEO approval workflow for designs, products, refunds."""

    def __init__(
        self,
        supabase_client: Any,
        responder: "Responder",
        orchestrator: "Orchestrator",
    ):
        self._db = supabase_client
        self._responder = responder
        self._orchestrator = orchestrator

    async def request_approval(
        self,
        resource_type: str,
        resource_id: str,
        platform: Platform,
        preview_text: str,
        preview_image_url: str | None = None,
    ) -> str:
        """Send approval request to CEO with approve/reject buttons.

        Returns the approval record ID.
        """
        approval_id = str(uuid.uuid4())

        # 1. Insert ceo_approvals record
        try:
            self._db.table("ceo_approvals").insert({
                "id": approval_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "status": "pending",
                "platform": platform.value,
            }).execute()
        except Exception as e:
            logger.error("approval_insert_failed", error=str(e))
            raise

        # 2. Send preview with buttons via Notifier (or fallback to responder)
        channel = platform.value
        notifier = getattr(self._responder, "notifier", None)
        if notifier:
            await notifier.request_approval(
                resource_type=resource_type,
                resource_id=resource_id,
                preview_text=preview_text,
                channel=channel,
                preview_image_url=preview_image_url,
            )
        else:
            # Legacy fallback
            await self._send_buttons(
                platform,
                preview_text if not preview_image_url else "Que opinas?",
                [
                    {"id": f"approve_{resource_type}_{resource_id}", "title": "Aprobar"},
                    {"id": f"reject_{resource_type}_{resource_id}", "title": "Rechazar"},
                ],
            )

        logger.info(
            "approval_requested",
            approval_id=approval_id,
            resource_type=resource_type,
            resource_id=resource_id,
            platform=platform.value,
        )
        return approval_id

    async def handle_response(self, message: NormalizedMessage) -> dict[str, Any]:
        """Process CEO approval/rejection button press.

        Returns dict with 'message' key for the response text.
        """
        payload = message.button_payload or ""
        match = _PAYLOAD_RE.match(payload)

        if not match:
            return {"message": "Boton no reconocido. Usa los botones de aprobar/rechazar."}

        action = match.group(1)  # "approve" or "reject"
        resource_type = match.group(2)
        resource_id = match.group(3)

        # Update ceo_approvals
        new_status = "approved" if action == "approve" else "rejected"
        try:
            self._db.table("ceo_approvals").update({
                "status": new_status,
                "ceo_response": action,
                "resolved_at": "now()",
            }).eq("resource_id", resource_id).eq("status", "pending").execute()
        except Exception as e:
            logger.error("approval_update_failed", error=str(e))
            return {"message": f"Error actualizando aprobacion: {str(e)[:100]}"}

        # Update design_tasks if applicable
        if resource_type == "design":
            try:
                design_status = "approved" if action == "approve" else "rejected"
                update_data: dict[str, Any] = {"status": design_status, "updated_at": "now()"}
                if action == "reject":
                    update_data["feedback"] = message.text or "Rechazado por CEO"
                self._db.table("design_tasks").update(update_data).eq("id", resource_id).execute()
            except Exception as e:
                logger.warning("design_task_update_failed", error=str(e))

        # Trigger post-approval action
        if action == "approve":
            agent_name = _POST_APPROVAL_AGENTS.get(resource_type)
            if agent_name:
                try:
                    await self._orchestrator.run_agent(
                        agent_name=agent_name,
                        task=f"[AUTO-APPROVAL] CEO approved {resource_type} {resource_id}. Process it.",
                    )
                except Exception as e:
                    logger.error("post_approval_agent_failed", agent=agent_name, error=str(e))
                    return {
                        "message": f"Aprobado! Pero hubo un error ejecutando {agent_name}: {str(e)[:100]}"
                    }

            return {"message": f"{resource_type.capitalize()} aprobado. Procesando..."}
        else:
            return {"message": f"{resource_type.capitalize()} rechazado. Feedback registrado."}

    async def _send_buttons(
        self,
        platform: Platform,
        body_text: str,
        buttons: list[dict[str, str]],
    ) -> None:
        """Send interactive buttons via the appropriate platform."""
        if platform == Platform.WHATSAPP:
            wa = self._responder._wa
            if wa:
                tools = wa.get_tools()
                send_buttons = tools.get("whatsapp_send_buttons")
                if send_buttons:
                    await send_buttons["handler"]({
                        "to": config.CEO_WHATSAPP_NUMBER,
                        "body_text": body_text,
                        "buttons": buttons,
                    })
                    return

        elif platform == Platform.TELEGRAM:
            tg = self._responder._tg
            if tg:
                tools = tg.get_tools()
                send_fn = tools.get("telegram_send")
                if send_fn:
                    # Telegram: inline keyboard as text fallback
                    btn_text = " | ".join(f"[{b['title']}]" for b in buttons)
                    await send_fn["handler"]({
                        "chat_id": config.CEO_TELEGRAM_CHAT_ID,
                        "text": f"{body_text}\n\n{btn_text}",
                    })
                    return

        # Fallback: just send text
        await self._responder.send_to_ceo(platform, body_text)
