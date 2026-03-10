"""
PodClaw — Event Dispatcher
=============================

Routes classified CEO messages to the appropriate agent via orchestrator.run_agent().
Does NOT reinvent execution logic — delegates entirely to the existing Orchestrator.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog

from podclaw.gateway.models import NormalizedMessage, Platform
from podclaw.router.classifier import EventClassifier, EventType

if TYPE_CHECKING:
    from podclaw.approval.manager import ApprovalManager
    from podclaw.core import Orchestrator
    from podclaw.router.responder import Responder

logger = structlog.get_logger(__name__)

# Static routing table: EventType → agent name
ROUTING_TABLE: dict[EventType, str | None] = {
    EventType.DESIGN_REQUEST: "designer",
    EventType.DESIGN_FROM_IMAGE: "designer",
    EventType.CATALOG_REQUEST: "cataloger",
    EventType.QUERY: "finance",
    EventType.RESEARCH_REQUEST: "researcher",
    EventType.MARKETING_REQUEST: "marketing",
    EventType.SYSTEM_COMMAND: None,  # handled directly
    EventType.APPROVAL: None,  # approval flow (Sprint 2)
    EventType.REJECTION: None,  # approval flow (Sprint 2)
    EventType.GENERAL: None,  # direct response
}

# WhatsApp message limit
_MAX_RESPONSE_LEN = 4096


class EventDispatcher:
    """Dispatches CEO messages to agents and sends results back."""

    def __init__(
        self,
        orchestrator: "Orchestrator",
        classifier: EventClassifier,
        responder: "Responder",
        approval_manager: "ApprovalManager | None" = None,
    ):
        self.orchestrator = orchestrator
        self.classifier = classifier
        self.responder = responder
        self.approval_manager = approval_manager

    async def dispatch(self, message: NormalizedMessage) -> None:
        """Classify, route to agent, and send result back to CEO."""
        event_type = await self.classifier.classify(message)
        agent_name = ROUTING_TABLE.get(event_type)

        logger.info(
            "dispatch_event",
            event_type=event_type.value,
            agent=agent_name or "direct",
            platform=message.platform.value,
            text_preview=(message.text or "")[:50],
        )

        if agent_name is None:
            await self._handle_direct(message, event_type)
            return

        # Build prompt with CEO context
        prompt = f"[CEO REQUEST via {message.platform.value}]\n{message.text or ''}"
        if message.image_url:
            prompt += f"\n[Reference image: {message.image_url}]"

        try:
            # Use existing orchestrator — all protections preserved
            result = await self.orchestrator.run_agent(
                agent_name=agent_name,
                task=prompt,
            )
            response_text = self._format_result(result)
        except Exception as e:
            logger.error("dispatch_agent_failed", agent=agent_name, error=str(e))
            response_text = f"Error ejecutando {agent_name}: {str(e)[:200]}"

        await self.responder.send_to_ceo(message.platform, response_text)

    async def _handle_direct(self, message: NormalizedMessage, event_type: EventType) -> None:
        """Handle events that don't require an agent."""
        if event_type == EventType.GENERAL:
            text = message.text or ""
            # Simple greeting detection
            if any(w in text.lower() for w in ("hola", "hello", "hi", "hey", "buenas")):
                await self.responder.send_to_ceo(
                    message.platform,
                    "Hola! Estoy aqui. Puedes pedirme disenar productos, consultar ventas, investigar tendencias, o gestionar el catalogo.",
                )
            else:
                await self.responder.send_to_ceo(
                    message.platform,
                    f"Recibido: \"{text[:100]}\". No estoy seguro de que necesitas. Prueba con: \"disena una camiseta de...\", \"cuanto vendimos?\", o \"investiga gorras\".",
                )

        elif event_type == EventType.SYSTEM_COMMAND:
            await self._handle_system_command(message)

        elif event_type in (EventType.APPROVAL, EventType.REJECTION):
            if self.approval_manager:
                result = await self.approval_manager.handle_response(message)
                await self.responder.send_to_ceo(
                    message.platform,
                    result.get("message", "Respuesta procesada."),
                )
            else:
                await self.responder.send_to_ceo(
                    message.platform,
                    "Sistema de aprobacion no disponible.",
                )

    async def _handle_system_command(self, message: NormalizedMessage) -> None:
        """Handle system commands (/status, /run, etc.)."""
        text = (message.text or "").strip().lower()

        if "status" in text:
            try:
                agents = self.orchestrator.get_agent_status()
                lines = ["Estado del sistema:"]
                for name, status in agents.items():
                    lines.append(f"  {name}: {status}")
                response = "\n".join(lines)
            except Exception:
                response = "Sistema operativo. Usa el panel admin para detalles."
            await self.responder.send_to_ceo(message.platform, response)

        elif any(w in text for w in ("pausa", "stop", "detén")):
            await self.responder.send_to_ceo(
                message.platform,
                "Pausa de agentes solo disponible desde el panel admin por seguridad.",
            )

        else:
            await self.responder.send_to_ceo(
                message.platform,
                "Comandos disponibles: status, pausa. Para acciones avanzadas, usa el panel admin.",
            )

    def _format_result(self, result: dict[str, Any]) -> str:
        """Extract and format agent result for CEO consumption."""
        if not result:
            return "Tarea completada sin resultado."

        # Extract response text
        response = result.get("response", "")
        if not response:
            status = result.get("status", "unknown")
            return f"Tarea completada (status: {status})."

        # Truncate for WhatsApp limit
        if len(response) > _MAX_RESPONSE_LEN:
            response = response[:_MAX_RESPONSE_LEN - 50] + "\n\n[Respuesta truncada]"

        return response
