"""
Tests for podclaw.approval.timeout — ApprovalTimeoutChecker
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from podclaw.approval.timeout import (
    ApprovalTimeoutChecker,
    REMINDER_THRESHOLD,
    TIMEOUT_THRESHOLD,
)


@pytest.fixture()
def mock_supabase():
    from podclaw.tests.conftest import MockSupabaseClient
    return MockSupabaseClient()


@pytest.fixture()
def mock_responder():
    resp = MagicMock()
    resp.send_to_ceo = AsyncMock()
    return resp


@pytest.fixture()
def checker(mock_supabase, mock_responder):
    return ApprovalTimeoutChecker(mock_supabase, mock_responder)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

class TestConstants:

    def test_reminder_threshold(self):
        assert REMINDER_THRESHOLD == timedelta(hours=4)

    def test_timeout_threshold(self):
        assert TIMEOUT_THRESHOLD == timedelta(hours=24)


# ---------------------------------------------------------------------------
# Timeout check
# ---------------------------------------------------------------------------

class TestTimeoutCheck:

    @pytest.mark.asyncio
    async def test_no_pending_returns_zeros(self, checker, mock_supabase):
        mock_supabase.set_table_data("ceo_approvals", [])
        result = await checker.check()
        assert result == {"reminders": 0, "timeouts": 0}

    @pytest.mark.asyncio
    async def test_recent_approval_no_action(self, checker, mock_supabase, mock_responder):
        now = datetime.now(timezone.utc)
        mock_supabase.set_table_data("ceo_approvals", [{
            "id": "test-id",
            "resource_type": "design",
            "resource_id": "res-id",
            "platform": "whatsapp",
            "created_at": now.isoformat(),
        }])
        result = await checker.check()
        assert result["reminders"] == 0
        assert result["timeouts"] == 0
        mock_responder.send_to_ceo.assert_not_called()

    @pytest.mark.asyncio
    async def test_old_approval_sends_reminder(self, checker, mock_supabase, mock_responder):
        old = datetime.now(timezone.utc) - timedelta(hours=6)
        mock_supabase.set_table_data("ceo_approvals", [{
            "id": "test-id",
            "resource_type": "design",
            "resource_id": "res-id",
            "platform": "whatsapp",
            "created_at": old.isoformat(),
        }])
        result = await checker.check()
        assert result["reminders"] == 1
        mock_responder.send_to_ceo.assert_called_once()

    @pytest.mark.asyncio
    async def test_very_old_approval_auto_timeout(self, checker, mock_supabase, mock_responder):
        very_old = datetime.now(timezone.utc) - timedelta(hours=30)
        mock_supabase.set_table_data("ceo_approvals", [{
            "id": "test-id",
            "resource_type": "design",
            "resource_id": "res-id",
            "platform": "whatsapp",
            "created_at": very_old.isoformat(),
        }])
        result = await checker.check()
        assert result["timeouts"] == 1
        mock_responder.send_to_ceo.assert_called_once()
