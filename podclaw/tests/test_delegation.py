"""
Tests for the async delegation subsystem.
==========================================

Covers:
- DelegationRequest serialization
- DelegationRegistry CRUD (register, get, update, pending, announce)
- DelegationWorker background execution with mocks
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.delegation import DelegationRequest, DelegationRegistry, DelegationWorker


# ---------------------------------------------------------------------------
# DelegationRequest
# ---------------------------------------------------------------------------


class TestDelegationRequest:
    """Tests for DelegationRequest dataclass."""

    def test_to_dict_roundtrip(self):
        req = DelegationRequest(
            id="abc-123",
            conversation_id="conv-001",
            agent_name="designer",
            task="Create summer designs",
            reason="Admin requested",
            status="pending",
            created_at="2026-02-22T10:00:00+00:00",
        )
        d = req.to_dict()
        restored = DelegationRequest.from_dict(d)
        assert restored.id == "abc-123"
        assert restored.agent_name == "designer"
        assert restored.status == "pending"
        assert restored.result is None
        assert restored.error is None

    def test_from_dict_ignores_extra_keys(self):
        d = {
            "id": "x",
            "conversation_id": "c",
            "agent_name": "researcher",
            "task": "t",
            "reason": "r",
            "status": "pending",
            "created_at": "2026-01-01T00:00:00+00:00",
            "unknown_field": "should be ignored",
        }
        req = DelegationRequest.from_dict(d)
        assert req.id == "x"
        assert not hasattr(req, "unknown_field")


# ---------------------------------------------------------------------------
# DelegationRegistry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestDelegationRegistry:
    """Tests for DelegationRegistry backed by StateStore."""

    async def test_register_and_get(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="del-001",
            conversation_id="conv-001",
            agent_name="designer",
            task="Create logos",
            reason="Branding request",
            status="pending",
            created_at="2026-02-22T10:00:00+00:00",
        )
        await registry.register(req)

        loaded = await registry.get("del-001")
        assert loaded is not None
        assert loaded.agent_name == "designer"
        assert loaded.status == "pending"

    async def test_get_nonexistent_returns_none(self, state_store):
        registry = DelegationRegistry(state_store)
        assert await registry.get("nonexistent") is None

    async def test_update_status_running(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="del-002",
            conversation_id="conv-001",
            agent_name="researcher",
            task="Analyze trends",
            reason="Market research",
            status="pending",
            created_at="2026-02-22T10:00:00+00:00",
        )
        await registry.register(req)
        await registry.update_status("del-002", "running")

        updated = await registry.get("del-002")
        assert updated.status == "running"
        assert updated.started_at is not None

    async def test_update_status_completed_with_result(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="del-003",
            conversation_id="conv-001",
            agent_name="designer",
            task="Create art",
            reason="Creative",
            status="running",
            created_at="2026-02-22T10:00:00+00:00",
            started_at="2026-02-22T10:00:01+00:00",
        )
        await registry.register(req)

        result = {"status": "completed", "tool_calls": 5, "total_cost_usd": 0.15}
        await registry.update_status("del-003", "completed", result=result)

        updated = await registry.get("del-003")
        assert updated.status == "completed"
        assert updated.completed_at is not None
        assert updated.result["tool_calls"] == 5

    async def test_pending_announces(self, state_store):
        registry = DelegationRegistry(state_store)

        # Two delegations for same conversation — one completed, one running
        for i, status in enumerate(["completed", "running"]):
            req = DelegationRequest(
                id=f"del-{i}",
                conversation_id="conv-X",
                agent_name="designer",
                task=f"Task {i}",
                reason="test",
                status=status,
                created_at=f"2026-02-22T10:00:0{i}+00:00",
                completed_at=f"2026-02-22T10:05:0{i}+00:00" if status == "completed" else None,
            )
            await registry.register(req)

        # Also a completed one for DIFFERENT conversation
        req = DelegationRequest(
            id="del-other",
            conversation_id="conv-Y",
            agent_name="researcher",
            task="Other task",
            reason="other",
            status="completed",
            created_at="2026-02-22T10:00:00+00:00",
            completed_at="2026-02-22T10:05:00+00:00",
        )
        await registry.register(req)

        announces = await registry.pending_announces("conv-X")
        assert len(announces) == 1
        assert announces[0].id == "del-0"
        assert announces[0].status == "completed"

    async def test_mark_announced(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="del-ann",
            conversation_id="conv-A",
            agent_name="designer",
            task="Design",
            reason="test",
            status="completed",
            created_at="2026-02-22T10:00:00+00:00",
            completed_at="2026-02-22T10:05:00+00:00",
        )
        await registry.register(req)

        await registry.mark_announced("del-ann")
        updated = await registry.get("del-ann")
        assert updated.status == "announced"

        # Should no longer appear in pending_announces
        announces = await registry.pending_announces("conv-A")
        assert len(announces) == 0

    async def test_pending_work(self, state_store):
        registry = DelegationRegistry(state_store)
        for i, status in enumerate(["pending", "running", "pending"]):
            req = DelegationRequest(
                id=f"pw-{i}",
                conversation_id="conv-W",
                agent_name="researcher",
                task=f"Task {i}",
                reason="test",
                status=status,
                created_at=f"2026-02-22T10:00:0{i}+00:00",
            )
            await registry.register(req)

        pending = await registry.pending_work()
        assert len(pending) == 2
        assert pending[0].id == "pw-0"
        assert pending[1].id == "pw-2"


# ---------------------------------------------------------------------------
# DelegationWorker
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestDelegationWorker:
    """Tests for DelegationWorker background execution."""

    async def test_executes_pending_delegation(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="work-001",
            conversation_id="conv-W",
            agent_name="researcher",
            task="Research competitors",
            reason="Market analysis",
            status="pending",
            created_at="2026-02-22T10:00:00+00:00",
        )
        await registry.register(req)

        # Mock orchestrator
        mock_orchestrator = MagicMock()
        mock_orchestrator.run_agent = AsyncMock(return_value={
            "status": "completed",
            "tool_calls": 3,
            "total_cost_usd": 0.08,
            "duration_seconds": 45,
            "response": "Found 5 competitors in the market.",
        })

        worker = DelegationWorker(
            registry=registry,
            orchestrator=mock_orchestrator,
            poll_interval=0.1,
        )

        # Start worker, let it run one cycle, then stop
        worker.start()
        await asyncio.sleep(0.5)
        worker.stop()

        # Verify delegation was executed
        updated = await registry.get("work-001")
        assert updated.status == "completed"
        assert updated.result["tool_calls"] == 3
        assert updated.started_at is not None
        assert updated.completed_at is not None

        mock_orchestrator.run_agent.assert_called_once_with("researcher", task="Research competitors")

    async def test_handles_agent_failure(self, state_store):
        registry = DelegationRegistry(state_store)
        req = DelegationRequest(
            id="work-fail",
            conversation_id="conv-F",
            agent_name="designer",
            task="Create designs",
            reason="test",
            status="pending",
            created_at="2026-02-22T10:00:00+00:00",
        )
        await registry.register(req)

        mock_orchestrator = MagicMock()
        mock_orchestrator.run_agent = AsyncMock(side_effect=RuntimeError("Agent crashed"))

        worker = DelegationWorker(
            registry=registry,
            orchestrator=mock_orchestrator,
            poll_interval=0.1,
        )

        worker.start()
        await asyncio.sleep(0.5)
        worker.stop()

        updated = await registry.get("work-fail")
        assert updated.status == "failed"
        assert "Agent crashed" in updated.error

    async def test_stop_is_idempotent(self, state_store):
        registry = DelegationRegistry(state_store)
        worker = DelegationWorker(
            registry=registry,
            orchestrator=MagicMock(),
            poll_interval=0.1,
        )
        worker.stop()  # should not raise
        worker.start()
        worker.stop()
        worker.stop()  # should not raise
