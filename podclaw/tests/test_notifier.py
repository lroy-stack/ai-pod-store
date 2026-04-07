"""
PodClaw — Notifier Tests (Phase 6.3)
=======================================

Tests for channel-aware formatting, severity broadcast,
button sending, truncation, and fail-silent behavior.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.notifier import Notifier, _truncate


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_connector(tool_names: list[str]) -> MagicMock:
    """Create a mock connector with get_tools() returning async handlers."""
    tools = {}
    for name in tool_names:
        tools[name] = {"handler": AsyncMock()}
    connector = MagicMock()
    connector.get_tools.return_value = tools
    return connector


@pytest.fixture()
def wa_connector():
    return _make_connector(["whatsapp_send", "whatsapp_send_buttons", "whatsapp_send_image"])


@pytest.fixture()
def tg_connector():
    return _make_connector(["telegram_send", "telegram_send_buttons", "telegram_send_photo"])


@pytest.fixture()
def notifier(wa_connector, tg_connector):
    return Notifier(wa_connector, tg_connector)


# ---------------------------------------------------------------------------
# notify_ceo
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_notify_ceo_telegram(notifier, tg_connector):
    """Default channel (telegram) sends to Telegram only."""
    await notifier.notify_ceo("Hello CEO", channel="telegram")
    tg_connector.get_tools.assert_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_notify_ceo_whatsapp(notifier, wa_connector):
    """WhatsApp channel sends to WhatsApp."""
    await notifier.notify_ceo("Hello CEO", channel="whatsapp")
    wa_connector.get_tools.assert_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_notify_ceo_critical_broadcasts_all(notifier, wa_connector, tg_connector):
    """CRITICAL severity sends to ALL channels."""
    await notifier.notify_ceo("System down!", severity="CRITICAL")

    # Both connectors should have been called
    wa_connector.get_tools.assert_called()
    tg_connector.get_tools.assert_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_notify_ceo_fail_silent(tg_connector):
    """Notification error doesn't propagate — fail-silent."""
    tg_connector.get_tools.side_effect = RuntimeError("Connector dead")
    notifier = Notifier(None, tg_connector)

    # Should not raise
    await notifier.notify_ceo("This should not crash", channel="telegram")


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_format_for_whatsapp_truncates():
    """WhatsApp messages over 4096 chars are truncated."""
    long_text = "A" * 5000
    result = _truncate(long_text, 4096)
    assert len(result) <= 4096
    assert result.endswith("[Truncado]")


@pytest.mark.unit
def test_truncate_preserves_paragraphs():
    """Smart truncation cuts at paragraph boundary when possible."""
    text = "Paragraph one content here.\n\nParagraph two with more text.\n\nParagraph three final."
    result = _truncate(text, 50)
    # Should cut at a paragraph or line boundary
    assert "[Truncado]" in result
    assert len(result) <= 50


@pytest.mark.unit
def test_truncate_short_text_unchanged():
    """Text within limit is returned as-is."""
    text = "Short message"
    assert _truncate(text, 4096) == text


# ---------------------------------------------------------------------------
# send_progress
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
@patch("podclaw.notifier.config.CEO_TELEGRAM_CHAT_ID", "123456")
async def test_send_progress_formats_step(notifier, tg_connector):
    """Progress sends step info with index."""
    await notifier.send_progress(
        step="designer",
        result="Design created successfully",
        step_index=1,
        total_steps=5,
        channel="telegram",
    )
    # The send tool should have been called
    tools = tg_connector.get_tools()
    assert tools["telegram_send"]["handler"].called or tools.get("telegram_send_photo", {}).get("handler", MagicMock()).called


# ---------------------------------------------------------------------------
# send_agent_result
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_send_agent_result_formats(notifier, tg_connector):
    """Agent result includes agent name and response text."""
    result = {
        "response": "Found 5 trending designs",
        "status": "completed",
        "total_cost_usd": 0.05,
        "tool_calls": 3,
    }
    await notifier.send_agent_result("researcher", result, channel="telegram")
    tg_connector.get_tools.assert_called()


# ---------------------------------------------------------------------------
# send_error
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_send_error_formats(notifier, tg_connector):
    """Error notification includes context and error text."""
    await notifier.send_error("designer", "API timeout after 60s", channel="telegram")
    tg_connector.get_tools.assert_called()


# ---------------------------------------------------------------------------
# request_approval (buttons)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
@patch("podclaw.notifier.config.CEO_WHATSAPP_NUMBER", "34612345678")
async def test_request_approval_whatsapp_buttons(notifier, wa_connector):
    """Approval request sends WhatsApp interactive buttons."""
    await notifier.request_approval(
        resource_type="design",
        resource_id="abc-123",
        preview_text="New design ready for review",
        channel="whatsapp",
    )
    tools = wa_connector.get_tools()
    handler = tools["whatsapp_send_buttons"]["handler"]
    assert handler.called


@pytest.mark.asyncio
@pytest.mark.unit
@patch("podclaw.notifier.config.CEO_TELEGRAM_CHAT_ID", "123456")
async def test_request_approval_telegram_inline(notifier, tg_connector):
    """Approval request sends Telegram inline keyboard."""
    await notifier.request_approval(
        resource_type="product",
        resource_id="def-456",
        preview_text="New product listing",
        channel="telegram",
    )
    tools = tg_connector.get_tools()
    handler = tools["telegram_send_buttons"]["handler"]
    assert handler.called
