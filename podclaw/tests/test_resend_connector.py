"""
PodClaw — Resend Connector Tests (Phase 6.8)
===============================================

Tests for ResendMCPConnector: tool registration, email validation,
send, batch, and stats.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.connectors.resend_connector import ResendMCPConnector, _validate_email


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def connector():
    return ResendMCPConnector(api_key="test-key", from_email="noreply@example.com")


# ---------------------------------------------------------------------------
# Tool Registration
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_get_tools_returns_4(connector):
    """Connector registers exactly 4 tools."""
    tools = connector.get_tools()
    assert len(tools) == 4
    assert set(tools.keys()) == {
        "resend_send_email",
        "resend_send_batch",
        "resend_list_emails",
        "resend_get_delivery_stats",
    }


@pytest.mark.unit
def test_all_tools_have_handler(connector):
    """Every tool has a callable handler."""
    for name, tool in connector.get_tools().items():
        assert "handler" in tool, f"Tool {name} missing handler"
        assert callable(tool["handler"]), f"Tool {name} handler not callable"


# ---------------------------------------------------------------------------
# Email Validation
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_validate_email_valid():
    _validate_email("user@example.com")  # Should not raise


@pytest.mark.unit
def test_validate_email_invalid():
    with pytest.raises(ValueError, match="Invalid email"):
        _validate_email("not-an-email")


@pytest.mark.unit
def test_validate_email_empty():
    with pytest.raises(ValueError, match="Invalid email"):
        _validate_email("")


# ---------------------------------------------------------------------------
# Send Email
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_send_email_validates_recipient(connector):
    """Invalid recipient email returns error."""
    tools = connector.get_tools()
    result = await tools["resend_send_email"]["handler"]({
        "to": "invalid-email",
        "subject": "Test",
    })
    assert "error" in result or "Invalid email" in str(result)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_send_email_success(connector):
    """Successful send with mocked HTTP response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "email_123"}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.is_closed = False

    with patch.object(connector, "_get_client", new_callable=AsyncMock, return_value=mock_client):
        tools = connector.get_tools()
        result = await tools["resend_send_email"]["handler"]({
            "to": "admin@example.com",
            "subject": "Test Subject",
            "html": "<p>Hello</p>",
        })

    assert result.get("id") == "email_123"
    mock_client.post.assert_called_once()


# ---------------------------------------------------------------------------
# Batch Send
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_batch_send_validates_email(connector):
    """Batch send with invalid email returns error."""
    tools = connector.get_tools()
    result = await tools["resend_send_batch"]["handler"]({
        "emails": [
            {"to": "bad-email", "subject": "Test", "html": "<p>Hi</p>"},
        ],
    })
    assert "error" in result or "Invalid email" in str(result)
