"""
PodClaw — E2E Product Creation Tests (Phase 6.6)
==================================================

End-to-end flow tests: CEO message → classify → agent dispatch,
pipeline execution, webhook routing, and approval flow.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.gateway.models import MessageType, NormalizedEvent, NormalizedMessage, Platform
from podclaw.pipeline_engine import PIPELINE_REGISTRY, PipelineResult, StepResult
from podclaw.router.classifier import EventType
from podclaw.router.dispatcher import EventDispatcher


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={
        "status": "completed",
        "response": "Design created for t-shirt.",
        "total_cost_usd": 0.50,
        "tool_calls": 5,
    })
    return orch


@pytest.fixture()
def mock_classifier():
    cls = MagicMock()
    cls.classify = AsyncMock(return_value=EventType.DESIGN_REQUEST)
    return cls


@pytest.fixture()
def mock_responder():
    resp = MagicMock()
    resp.send_to_ceo = AsyncMock()
    resp.notifier = MagicMock()
    resp.notifier.send_agent_result = AsyncMock()
    resp.notifier.send_error = AsyncMock()
    return resp


@pytest.fixture()
def mock_pipeline_engine():
    pe = MagicMock()
    pe.execute = AsyncMock(return_value=PipelineResult(
        pipeline_name="catalog_sync",
        status="completed",
        step_results=[
            StepResult(step_name="sync", agent="cataloger", status="completed"),
            StepResult(step_name="verify", agent="qa_inspector", status="completed"),
        ],
    ))
    return pe


@pytest.fixture()
def mock_approval_manager():
    am = MagicMock()
    am.handle_response = AsyncMock(return_value={"message": "Producto aprobado. Procesando..."})
    return am


@pytest.fixture()
def dispatcher(mock_orchestrator, mock_classifier, mock_responder, mock_pipeline_engine, mock_approval_manager):
    return EventDispatcher(
        orchestrator=mock_orchestrator,
        classifier=mock_classifier,
        responder=mock_responder,
        pipeline_engine=mock_pipeline_engine,
        approval_manager=mock_approval_manager,
    )


# ---------------------------------------------------------------------------
# CEO → Agent dispatch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_ceo_design_request_triggers_designer(dispatcher, mock_orchestrator, mock_classifier):
    """CEO sends 'Diseña una camiseta' → classifier → designer agent."""
    msg = NormalizedMessage.create(
        platform=Platform.TELEGRAM,
        sender_id="12345",
        is_ceo=True,
        msg_type=MessageType.TEXT,
        text="Diseña una camiseta de gatos",
    )

    mock_classifier.classify.return_value = EventType.DESIGN_REQUEST
    await dispatcher.dispatch(msg)

    mock_orchestrator.run_agent.assert_called_once()
    call_kwargs = mock_orchestrator.run_agent.call_args.kwargs
    assert call_kwargs["agent_name"] == "designer"
    assert "Diseña una camiseta de gatos" in call_kwargs["task"]


# ---------------------------------------------------------------------------
# Webhook → Pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_webhook_printful_triggers_catalog_sync(dispatcher, mock_pipeline_engine):
    """Printful product_updated webhook → catalog_sync pipeline."""
    event = NormalizedEvent.create(
        source="printful",
        event_type="webhook_printful",
        channel="bridge",
        payload={"type": "product_updated", "data": {"id": "prod_123"}},
    )

    with patch("podclaw.pipeline_engine.PIPELINE_REGISTRY", PIPELINE_REGISTRY):
        await dispatcher.dispatch_event(event)

    mock_pipeline_engine.execute.assert_called_once()
    call_args = mock_pipeline_engine.execute.call_args
    assert call_args.kwargs.get("source") == "printful" or call_args[1].get("source") == "printful"


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_webhook_stripe_dispute_triggers_support(dispatcher, mock_pipeline_engine):
    """Stripe dispute webhook → customer_support pipeline."""
    event = NormalizedEvent.create(
        source="stripe",
        event_type="webhook_stripe",
        channel="bridge",
        payload={"type": "charge.dispute.created", "data": {"id": "dp_123"}},
    )

    with patch("podclaw.pipeline_engine.PIPELINE_REGISTRY", PIPELINE_REGISTRY):
        await dispatcher.dispatch_event(event)

    mock_pipeline_engine.execute.assert_called_once()


# ---------------------------------------------------------------------------
# Approval flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_approval_flow_approve_publishes(dispatcher, mock_approval_manager, mock_responder):
    """CEO approves a product → approval manager processes it."""
    msg = NormalizedMessage.create(
        platform=Platform.TELEGRAM,
        sender_id="12345",
        is_ceo=True,
        msg_type=MessageType.BUTTON_RESPONSE,
        button_payload="approve_product_abc-123",
    )

    # Classifier returns APPROVAL for button payloads
    dispatcher.classifier.classify = AsyncMock(return_value=EventType.APPROVAL)

    await dispatcher.dispatch(msg)

    mock_approval_manager.handle_response.assert_called_once()
    mock_responder.send_to_ceo.assert_called_once()
