"""
PodClaw — Event Classifier
=============================

Classifies a NormalizedMessage from the CEO into an EventType.

Strategy (dual classification):
  1. Mechanical first (free, <1ms): regex patterns + message type checks
  2. Haiku fallback (~$0.001, <2s): LLM classification for ambiguous messages
  3. Default: GENERAL if all else fails
"""

from __future__ import annotations

import re
from enum import Enum

import structlog

from podclaw.gateway.models import MessageType, NormalizedMessage

logger = structlog.get_logger(__name__)


class EventType(Enum):
    """Classification of CEO messages into actionable event types."""
    DESIGN_REQUEST = "ceo.design_request"
    DESIGN_FROM_IMAGE = "ceo.design_from_image"
    CATALOG_REQUEST = "ceo.catalog_request"
    QUERY = "ceo.query"
    RESEARCH_REQUEST = "ceo.research_request"
    MARKETING_REQUEST = "ceo.marketing_request"
    SYSTEM_COMMAND = "ceo.system_command"
    APPROVAL = "ceo.approve"
    REJECTION = "ceo.reject"
    GENERAL = "ceo.general"


# Regex patterns for mechanical classification (case-insensitive)
# ORDER MATTERS: first match wins. More specific patterns go first.
_PATTERNS: list[tuple[re.Pattern, EventType]] = [
    # 1. System commands (highest priority)
    (re.compile(r"(pausa|stop|resume|restart|status|reinicia|detén)", re.I), EventType.SYSTEM_COMMAND),
    # 2. Newsletter/subscribers (unambiguous — before catalog to avoid "catalogo" clash)
    (re.compile(r"(newsletter|suscriptor|subscriber|email\s+campaign|campaña\s+email|promo\w*\s+email)", re.I), EventType.MARKETING_REQUEST),
    # 3. Design requests
    (re.compile(r"(diseñ|design|crea\w*\s+camiseta|crea\w*\s+hoodie|crea\w*\s+gorra|crea\w*\s+producto)", re.I), EventType.DESIGN_REQUEST),
    # 4. Catalog management — requires action verbs (not just "catalogo" alone)
    (re.compile(r"(publica|publish|lista\w*\s+producto|actualiza\w*\s+producto|borra\w*\s+producto|gestiona\w*\s+catálogo|sync\w*\s+catálogo)", re.I), EventType.CATALOG_REQUEST),
    # 5. Finance / metrics queries
    (re.compile(r"(cuánto|vendimos|revenue|ingres|cost|gananc|pedido|orden|venta|factur|métric|cupón|cupon|descuento)", re.I), EventType.QUERY),
    # 6. Research
    (re.compile(r"(investiga|research|tendencia|trend|competencia|mercado|nicho)", re.I), EventType.RESEARCH_REQUEST),
    # 7. Generic marketing (broader catch-all)
    (re.compile(r"(marketing|campaña|campaign|promo)", re.I), EventType.MARKETING_REQUEST),
]

_HAIKU_PROMPT = """Classify this CEO message into exactly ONE category. Respond with ONLY the category name, nothing else.

Categories:
- design_request: wants to create a design or product
- catalog_request: wants to manage products/catalog (publish, update, delete)
- query: asking about business metrics, orders, revenue, status
- research_request: wants market research or trend analysis
- marketing_request: wants marketing content, campaigns, social media
- general: casual conversation, greeting, or unclear intent

Message: "{text}"
Category:"""

_CATEGORY_MAP = {
    "design_request": EventType.DESIGN_REQUEST,
    "catalog_request": EventType.CATALOG_REQUEST,
    "query": EventType.QUERY,
    "research_request": EventType.RESEARCH_REQUEST,
    "marketing_request": EventType.MARKETING_REQUEST,
    "general": EventType.GENERAL,
}


class EventClassifier:
    """Classifies CEO messages into EventType using regex + LLM fallback."""

    async def classify(self, message: NormalizedMessage) -> EventType:
        """Classify a normalized CEO message into an EventType."""

        # 1. Button responses — deterministic
        if message.type == MessageType.BUTTON_RESPONSE:
            payload = message.button_payload or ""
            if payload.startswith("approve"):
                return EventType.APPROVAL
            if payload.startswith("reject"):
                return EventType.REJECTION
            # Unknown button — treat as general
            return EventType.GENERAL

        # 2. Image messages — design from image
        if message.type == MessageType.IMAGE:
            return EventType.DESIGN_FROM_IMAGE

        # 3. Command messages (Telegram /commands)
        if message.type == MessageType.COMMAND:
            return EventType.SYSTEM_COMMAND

        # 4. Text messages — regex patterns first
        text = message.text or ""
        for pattern, event_type in _PATTERNS:
            if pattern.search(text):
                logger.debug("classifier_regex_match", event_type=event_type.value, text=text[:50])
                return event_type

        # 5. Haiku LLM fallback for ambiguous text
        return await self._classify_with_haiku(text)

    async def _classify_with_haiku(self, text: str) -> EventType:
        """Use Haiku to classify ambiguous messages (~$0.001/call)."""
        try:
            from podclaw.llm_helper import quick_llm_call

            result = await quick_llm_call(
                system_prompt="You classify user messages into exactly one category. Reply with ONLY the category name, nothing else.",
                user_prompt=_HAIKU_PROMPT.format(text=text[:500]),
                model="claude-haiku-4-5-20251001",
                max_budget=0.005,
                max_retries=1,
            )

            category = result.strip().lower()
            event_type = _CATEGORY_MAP.get(category, EventType.GENERAL)
            logger.debug("classifier_haiku_result", category=category, event_type=event_type.value)
            return event_type

        except Exception as e:
            logger.warning("classifier_haiku_failed", error=str(e))
            return EventType.GENERAL
