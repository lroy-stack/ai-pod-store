"""
PodClaw — NormalizedEvent Tests (Phase 6.7)
=============================================

Tests for NormalizedEvent dataclass, factory methods,
and EventDispatcher.dispatch_event() routing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.gateway.models import (
    MessageType,
    NormalizedEvent,
    NormalizedMessage,
    Platform,
)
from podclaw.router.dispatcher import (
    PIPELINE_ROUTES,
    EventDispatcher,
    _guess_message_type,
)


# ---------------------------------------------------------------------------
# NormalizedEvent dataclass
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_normalized_event_create():
    """Factory create() with defaults."""
    event = NormalizedEvent.create(
        source="stripe",
        event_type="webhook_stripe",
        channel="bridge",
        payload={"type": "charge.dispute.created"},
    )
    assert event.source == "stripe"
    assert event.event_type == "webhook_stripe"
    assert event.channel == "bridge"
    assert event.payload == {"type": "charge.dispute.created"}
    assert event.id  # UUID generated
    assert event.timestamp  # datetime set


@pytest.mark.unit
def test_normalized_event_from_message():
    """Convert NormalizedMessage to NormalizedEvent."""
    msg = NormalizedMessage.create(
        platform=Platform.TELEGRAM,
        sender_id="123456",
        is_ceo=True,
        msg_type=MessageType.TEXT,
        text="Diseña una camiseta",
    )
    event = NormalizedEvent.from_message(msg)
    assert event.source == "telegram"
    assert event.event_type == "ceo_message"
    assert event.channel == "telegram"
    assert event.payload["text"] == "Diseña una camiseta"
    assert event.sender_id == "123456"


@pytest.mark.unit
def test_normalized_event_defaults():
    """Default fields are set correctly."""
    event = NormalizedEvent(
        id="test-id",
        source="printful",
        event_type="webhook_printful",
        channel="bridge",
    )
    assert event.payload == {}
    assert event.sender_id is None
    assert isinstance(event.timestamp, datetime)


# ---------------------------------------------------------------------------
# _guess_message_type
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_guess_message_type_text():
    assert _guess_message_type({"text": "Hello"}) == MessageType.TEXT


@pytest.mark.unit
def test_guess_message_type_command():
    assert _guess_message_type({"text": "/status"}) == MessageType.COMMAND


@pytest.mark.unit
def test_guess_message_type_image():
    assert _guess_message_type({"image_url": "https://example.com/img.png"}) == MessageType.IMAGE


@pytest.mark.unit
def test_guess_message_type_button():
    assert _guess_message_type({"button_payload": "approve_design_123"}) == MessageType.BUTTON_RESPONSE


# ---------------------------------------------------------------------------
# EventDispatcher.dispatch_event
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_dispatcher():
    """EventDispatcher with mocked dependencies."""
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={"status": "completed", "response": "OK"})

    classifier = MagicMock()
    responder = MagicMock()
    responder.send_to_ceo = AsyncMock()
    responder.notifier = None

    pipeline_engine = MagicMock()
    pipeline_engine.execute = AsyncMock()

    dispatcher = EventDispatcher(
        orchestrator=orch,
        classifier=classifier,
        responder=responder,
        pipeline_engine=pipeline_engine,
    )
    return dispatcher


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_event_to_pipeline(mock_dispatcher):
    """Webhook event matching PIPELINE_ROUTES triggers pipeline execution."""
    event = NormalizedEvent.create(
        source="printful",
        event_type="webhook_printful",
        channel="bridge",
        payload={"type": "product_updated"},
    )

    # Manually set PIPELINE_ROUTES key to match
    with patch.dict(PIPELINE_ROUTES, {"webhook_printful.product_updated": "catalog_sync"}):
        with patch("podclaw.pipeline_engine.PIPELINE_REGISTRY", {"catalog_sync": MagicMock()}):
            await mock_dispatcher.dispatch_event(event)

    mock_dispatcher.pipeline_engine.execute.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_event_ceo_message(mock_dispatcher):
    """ceo_message event converts to NormalizedMessage and dispatches."""
    event = NormalizedEvent(
        id="test-123",
        source="telegram",
        event_type="ceo_message",
        channel="telegram",
        payload={"text": "Hola"},
        timestamp=datetime.now(timezone.utc),
        sender_id="12345",
    )

    with patch.object(mock_dispatcher, "dispatch", new_callable=AsyncMock) as mock_dispatch:
        await mock_dispatcher.dispatch_event(event)
        mock_dispatch.assert_called_once()
        msg = mock_dispatch.call_args[0][0]
        assert msg.text == "Hola"
        assert msg.is_ceo is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_event_unrouted(mock_dispatcher):
    """Unknown event type is logged and skipped."""
    event = NormalizedEvent.create(
        source="unknown",
        event_type="random_event",
        channel="bridge",
        payload={},
    )

    await mock_dispatcher.dispatch_event(event)
    # No pipeline or dispatch called
    mock_dispatcher.pipeline_engine.execute.assert_not_called()
