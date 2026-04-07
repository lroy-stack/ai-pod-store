"""
PodClaw — Event Dispatcher
=============================

Routes CEO messages directly to the conversational orchestrator.
Handles progressive messaging (typing, tool visibility, metrics header).

Pipeline routing for webhook events (Stripe, Printful) via PIPELINE_ROUTES.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import structlog

from podclaw.gateway.models import NormalizedEvent, NormalizedMessage, Platform

if TYPE_CHECKING:
    from podclaw.approval.manager import ApprovalManager
    from podclaw.core import Orchestrator
    from podclaw.pipeline_engine import PipelineEngine
    from podclaw.router.responder import Responder

logger = structlog.get_logger(__name__)

# Pipeline routes: "{event_type}.{payload_type}" -> pipeline name
PIPELINE_ROUTES: dict[str, str] = {
    "webhook_printful.product_updated": "catalog_sync",
    "webhook_printful.product_deleted": "catalog_sync",
    "webhook_stripe.charge.dispute.created": "customer_support",
    "webhook_stripe.charge.dispute.updated": "customer_support",
}


class EventDispatcher:
    """Dispatches CEO messages to the orchestrator and sends results back."""

    def __init__(
        self,
        orchestrator: "Orchestrator",
        classifier: Any = None,  # Kept for backward compat (bridge init)
        responder: "Responder" = None,
        approval_manager: "ApprovalManager | None" = None,
        pipeline_engine: "PipelineEngine | None" = None,
    ):
        self.orchestrator = orchestrator
        self.responder = responder
        self.approval_manager = approval_manager
        self.pipeline_engine = pipeline_engine

    async def dispatch(self, message: NormalizedMessage) -> None:
        """Route CEO messages to the orchestrator with progressive messaging.

        Flow:
        1. Typing indicator (immediate)
        2. Tool call messages (each tool -> separate Telegram message)
        3. Final response with header [N tools | $cost | Xs]
        """
        text = message.text or ""
        platform_key = message.platform.value

        # Handle Telegram commands before dispatching to orchestrator
        if text.startswith("/"):
            handled = await self._handle_command(text, message.platform, platform_key)
            if handled:
                return

        logger.info(
            "dispatch_ceo",
            platform=platform_key,
            text_preview=text[:50],
        )

        try:
            # 1. Typing indicator — immediate feedback
            try:
                await self._send_typing(message.platform)
            except Exception:
                pass

            # 2. Tool call callback — each tool -> visible message
            _tool_labels = {
                "supabase_query": "Consultando base de datos",
                "supabase_count": "Contando registros",
                "supabase_insert": "Guardando datos",
                "supabase_update": "Actualizando datos",
                "printful_get_product": "Consultando Printful",
                "printful_list_products": "Listando productos",
                "printful_create_product": "Creando producto",
                "stripe_get_balance": "Revisando Stripe",
                "stripe_list_charges": "Consultando cargos",
                "resend_send_email": "Enviando email",
                "resend_send_batch": "Enviando emails",
                "fal_generate_image": "Generando imagen",
                "gemini_check_image_quality": "Verificando calidad",
                "crawl_url": "Investigando web",
            }

            async def _on_tool(tool_name: str) -> None:
                # Clean MCP prefix: mcp__supabase__supabase_query -> supabase_query
                clean = tool_name.split("__")[-1] if "__" in tool_name else tool_name
                label = _tool_labels.get(clean, clean.replace("_", " ").title())
                try:
                    await self.responder.send_to_ceo(
                        message.platform, f"\u2699 {label}..."
                    )
                except Exception:
                    pass

            # 3. Intermediate text callback — agent "thinking out loud"
            async def _on_text(intermediate: str) -> None:
                try:
                    await self.responder.send_to_ceo(message.platform, intermediate)
                except Exception:
                    pass

            # 4. Execute orchestrator
            result = await self.orchestrator.run_orchestrator(
                platform=platform_key,
                text=text,
                image_url=message.image_url,
                on_tool_call=_on_tool,
                on_text=_on_text,
            )

            # 5. Final response with metrics header
            response = result.get("response", "")
            tools = result.get("tool_calls", 0)
            cost = result.get("cost_usd", 0)
            duration = result.get("duration_s", 0)

            if tools > 0:
                header = f"[{tools} tools | ${cost:.2f} | {duration:.0f}s]"
                final = f"{header}\n\n{response}"
            else:
                final = response

            await self.responder.send_to_ceo(message.platform, final)
            logger.info(
                "dispatch_response_sent",
                platform=platform_key,
                tools=tools,
                cost=round(cost, 3),
                duration=round(duration),
            )

        except Exception as e:
            logger.error("dispatch_failed", platform=platform_key, error=str(e))
            try:
                await self.responder.send_to_ceo(
                    message.platform, f"Error: {str(e)[:200]}"
                )
            except Exception:
                pass

    async def _handle_command(self, text: str, platform: Platform, platform_key: str) -> bool:
        """Handle /commands. Returns True if handled, False to pass to orchestrator."""
        cmd = text.strip().lower().split()[0]

        if cmd == "/new":
            # Reset CEO session
            key = f"ceo:{platform_key}"
            store = self.orchestrator._ceo_sdk_sessions
            store.pop(key, None)
            if self.orchestrator.state:
                await self.orchestrator.state.set("ceo_sdk_sessions", store)
            await self.responder.send_to_ceo(platform, "Sesion reiniciada. Nuevo contexto.")
            logger.info("command_new_session", platform=platform_key)
            return True

        if cmd == "/status":
            status = self.orchestrator.get_status()
            key = f"ceo:{platform_key}"
            session = self.orchestrator._ceo_sdk_sessions.get(key, {})
            session_age = ""
            if session.get("timestamp"):
                age_s = datetime.now(timezone.utc).timestamp() - session["timestamp"]
                session_age = f"\nSesion: {int(age_s // 60)} min"
            msg = (
                f"Agentes: {status['agent_count']}\n"
                f"Activos: {len(status['active_sessions'])}"
                f"{session_age}"
            )
            await self.responder.send_to_ceo(platform, msg)
            return True

        if cmd == "/compact":
            # Force session reset (compaction is SDK-managed, we just reset)
            key = f"ceo:{platform_key}"
            self.orchestrator._ceo_sdk_sessions.pop(key, None)
            await self.responder.send_to_ceo(platform, "Contexto comprimido. Sesion fresca.")
            return True

        return False  # Not a recognized command — pass to orchestrator

    async def _send_typing(self, platform: Platform) -> None:
        """Send typing indicator via Telegram Bot API."""
        from podclaw import config
        if platform != Platform.TELEGRAM:
            return
        chat_id = config.CEO_TELEGRAM_CHAT_ID
        token = config.TELEGRAM_BOT_TOKEN
        if not chat_id or not token:
            return
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"https://api.telegram.org/bot{token}/sendChatAction",
                json={"chat_id": chat_id, "action": "typing"},
            )

    async def dispatch_event(self, event: NormalizedEvent) -> None:
        """Route a NormalizedEvent to pipeline or agent.

        For webhook events (Stripe, Printful) — checks PIPELINE_ROUTES first.
        For CEO messages — falls through to existing dispatch() via classify.
        """
        # Check pipeline routes first
        route_key = f"{event.event_type}.{event.payload.get('type', '')}"
        pipeline_name = PIPELINE_ROUTES.get(route_key) or PIPELINE_ROUTES.get(event.event_type)

        if pipeline_name and self.pipeline_engine:
            from podclaw.pipeline_engine import PIPELINE_REGISTRY

            pipeline = PIPELINE_REGISTRY.get(pipeline_name)
            if pipeline:
                logger.info(
                    "dispatch_event_to_pipeline",
                    event_type=event.event_type,
                    pipeline=pipeline_name,
                )
                try:
                    await self.pipeline_engine.execute(
                        pipeline, variables=event.payload, source=event.source
                    )
                except Exception as e:
                    logger.error(
                        "dispatch_event_pipeline_failed",
                        pipeline=pipeline_name,
                        error=str(e),
                    )
                return

        # For ceo_message events, convert back to NormalizedMessage and dispatch
        if event.event_type == "ceo_message":
            msg = NormalizedMessage(
                id=event.id,
                platform=Platform(event.channel),
                sender_id=event.sender_id or "",
                is_ceo=True,
                type=_guess_message_type(event.payload),
                text=event.payload.get("text"),
                image_url=event.payload.get("image_url"),
                button_payload=event.payload.get("button_payload"),
                timestamp=event.timestamp,
            )
            await self.dispatch(msg)
            return

        # Unknown event type — log and skip
        logger.warning(
            "dispatch_event_unrouted",
            event_type=event.event_type,
            source=event.source,
        )


def _guess_message_type(payload: dict) -> "MessageType":
    """Infer MessageType from NormalizedEvent payload."""
    from podclaw.gateway.models import MessageType

    if payload.get("button_payload"):
        return MessageType.BUTTON_RESPONSE
    if payload.get("image_url"):
        return MessageType.IMAGE
    text = payload.get("text", "")
    if text.startswith("/"):
        return MessageType.COMMAND
    return MessageType.TEXT
