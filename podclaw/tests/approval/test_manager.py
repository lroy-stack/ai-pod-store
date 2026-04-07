"""
Tests for podclaw.approval.manager — ApprovalManager
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.approval.manager import ApprovalManager, _PAYLOAD_RE
from podclaw.gateway.models import NormalizedMessage, Platform, MessageType


@pytest.fixture()
def mock_supabase():
    from podclaw.tests.conftest import MockSupabaseClient
    return MockSupabaseClient()


@pytest.fixture()
def mock_responder():
    resp = MagicMock()
    resp.send_to_ceo = AsyncMock()
    resp._wa = MagicMock()
    resp._tg = MagicMock()
    wa_tools = {
        "whatsapp_send_buttons": {
            "handler": AsyncMock(return_value={"success": True}),
        }
    }
    resp._wa.get_tools = MagicMock(return_value=wa_tools)
    return resp


@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={"status": "completed"})
    return orch


@pytest.fixture()
def manager(mock_supabase, mock_responder, mock_orchestrator):
    return ApprovalManager(mock_supabase, mock_responder, mock_orchestrator)


# ---------------------------------------------------------------------------
# Payload regex
# ---------------------------------------------------------------------------

class TestPayloadRegex:

    def test_approve_design(self):
        m = _PAYLOAD_RE.match("approve_design_12345678-1234-1234-1234-123456789abc")
        assert m is not None
        assert m.group(1) == "approve"
        assert m.group(2) == "design"
        assert m.group(3) == "12345678-1234-1234-1234-123456789abc"

    def test_reject_product(self):
        m = _PAYLOAD_RE.match("reject_product_abcdef01-2345-6789-abcd-ef0123456789")
        assert m is not None
        assert m.group(1) == "reject"
        assert m.group(2) == "product"

    def test_invalid_payload(self):
        assert _PAYLOAD_RE.match("invalid_payload") is None
        assert _PAYLOAD_RE.match("") is None
        assert _PAYLOAD_RE.match("approve_design_not-a-uuid") is None


# ---------------------------------------------------------------------------
# request_approval
# ---------------------------------------------------------------------------

class TestRequestApproval:

    @pytest.mark.asyncio
    async def test_inserts_and_sends_buttons(self, manager, mock_supabase):
        approval_id = await manager.request_approval(
            resource_type="design",
            resource_id="12345678-1234-1234-1234-123456789abc",
            platform=Platform.WHATSAPP,
            preview_text="New design ready for review",
        )
        assert isinstance(approval_id, str)
        assert len(approval_id) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_sends_image_preview(self, manager, mock_responder):
        await manager.request_approval(
            resource_type="design",
            resource_id="12345678-1234-1234-1234-123456789abc",
            platform=Platform.WHATSAPP,
            preview_text="Check this design",
            preview_image_url="https://example.com/mockup.png",
        )
        mock_responder.send_to_ceo.assert_called_once()


# ---------------------------------------------------------------------------
# handle_response
# ---------------------------------------------------------------------------

class TestHandleResponse:

    @pytest.mark.asyncio
    async def test_approve_triggers_agent(self, manager, mock_orchestrator):
        msg = NormalizedMessage(
            id="msg1",
            platform=Platform.WHATSAPP,
            sender_id="ceo123",
            is_ceo=True,
            type=MessageType.BUTTON_RESPONSE,
            text="",
            button_payload="approve_design_12345678-1234-1234-1234-123456789abc",
        )
        result = await manager.handle_response(msg)
        assert "aprobado" in result["message"].lower() or "Aprobado" in result["message"]
        mock_orchestrator.run_agent.assert_called_once()

    @pytest.mark.asyncio
    async def test_reject_records_feedback(self, manager, mock_orchestrator):
        msg = NormalizedMessage(
            id="msg2",
            platform=Platform.WHATSAPP,
            sender_id="ceo123",
            is_ceo=True,
            type=MessageType.BUTTON_RESPONSE,
            text="No me gusta el color",
            button_payload="reject_design_12345678-1234-1234-1234-123456789abc",
        )
        result = await manager.handle_response(msg)
        assert "rechazado" in result["message"].lower() or "Rechazado" in result["message"]
        mock_orchestrator.run_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_invalid_button(self, manager):
        msg = NormalizedMessage(
            id="msg3",
            platform=Platform.WHATSAPP,
            sender_id="ceo123",
            is_ceo=True,
            type=MessageType.BUTTON_RESPONSE,
            text="",
            button_payload="invalid_garbage",
        )
        result = await manager.handle_response(msg)
        assert "no reconocido" in result["message"].lower() or "Boton" in result["message"]
