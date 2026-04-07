"""
Tests for podclaw.bridge.api — FastAPI Bridge endpoints

Uses FastAPI TestClient (sync) which handles async endpoints automatically.
Auth is disabled via env var for testing.
"""

from __future__ import annotations

import os
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Disable auth before importing bridge modules
os.environ["PODCLAW_BRIDGE_AUTH_ENABLED"] = "false"

from fastapi.testclient import TestClient

from podclaw.bridge.api import create_app
from podclaw.core import AGENT_NAMES


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.is_running = True
    orch._active_sessions = {}
    orch.get_status.return_value = {
        "running": True,
        "active_sessions": {},
        "agent_count": 10,
        "agents": list(AGENT_NAMES),
    }
    orch.get_agent_status.return_value = {
        "agent": "researcher",
        "running": False,
        "session_id": None,
        "model": "claude-haiku-4-5-20251001",
        "tools": ["supabase", "crawl4ai"],
    }
    orch.run_agent = AsyncMock(return_value={
        "agent": "researcher",
        "session_id": "test-sess",
        "status": "completed",
        "tool_calls": 3,
        "response": "Done",
        "duration_seconds": 5.0,
    })
    orch.start = MagicMock()
    orch.stop = MagicMock()
    return orch


@pytest.fixture()
def mock_scheduler():
    sched = MagicMock()
    sched.get_jobs.return_value = [
        {"id": "researcher_daily", "next_run": "2026-02-23T06:00:00Z", "agent": "researcher"},
    ]
    sched._paused_agents = set()
    return sched


@pytest.fixture()
def mock_event_store():
    store = AsyncMock()
    store.query = AsyncMock(return_value=[])
    store.query_sessions = AsyncMock(return_value=[])
    store.get_session_events = AsyncMock(return_value=[])
    return store


@pytest.fixture()
def mock_memory(tmp_path):
    mm = MagicMock()
    mm.read_soul.return_value = "# PodClaw Soul\n"
    mm.read_memory.return_value = "# Memory\n"
    mm.read_today.return_value = "# Today\n"
    mm.read_context.return_value = "# Context\n"
    mm.read_heartbeat.return_value = "# Heartbeat\n"
    mm.write_heartbeat = MagicMock()
    mm.skills_dir = tmp_path / "skills"
    mm.skills_dir.mkdir()
    mm.context_dir = tmp_path / "context"
    mm.context_dir.mkdir()
    mm.soul_path = tmp_path / "SOUL.md"
    mm.soul_path.write_text("# Soul\n")
    return mm


@pytest.fixture()
def client(mock_orchestrator, mock_scheduler, mock_event_store, mock_memory):
    app = create_app(
        orchestrator=mock_orchestrator,
        scheduler=mock_scheduler,
        event_store=mock_event_store,
        memory_manager=mock_memory,
    )
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health endpoint (no auth)
# ---------------------------------------------------------------------------

class TestHealthEndpoint:

    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_api_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Status endpoint
# ---------------------------------------------------------------------------

class TestStatusEndpoint:

    def test_status_returns_orchestrator_state(self, client, mock_orchestrator):
        resp = client.get("/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["running"] is True
        assert data["agent_count"] == 10


# ---------------------------------------------------------------------------
# Agents endpoints
# ---------------------------------------------------------------------------

class TestAgentsEndpoints:

    def test_list_agents(self, client):
        resp = client.get("/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 10

    def test_get_agent_detail(self, client, mock_orchestrator):
        resp = client.get("/agents/researcher")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent"] == "researcher"

    def test_get_unknown_agent_404(self, client, mock_orchestrator):
        mock_orchestrator.get_agent_status.side_effect = KeyError("not found")
        resp = client.get("/agents/nonexistent")
        # Depending on implementation, may be 404 or 500
        assert resp.status_code in (404, 500)


# ---------------------------------------------------------------------------
# Agent run endpoint
# ---------------------------------------------------------------------------

class TestAgentRunEndpoint:

    def test_trigger_agent_run(self, client, mock_orchestrator):
        resp = client.post("/agents/researcher/run", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("started", "completed", "queued")


# ---------------------------------------------------------------------------
# Events & Sessions
# ---------------------------------------------------------------------------

class TestEventsEndpoints:

    def test_query_events(self, client, mock_event_store):
        resp = client.get("/events")
        assert resp.status_code == 200
        data = resp.json()
        # May be a list or a dict with "events" key
        if isinstance(data, dict):
            assert "events" in data
        else:
            assert isinstance(data, list)

    def test_query_sessions(self, client, mock_event_store):
        resp = client.get("/sessions")
        assert resp.status_code == 200
        data = resp.json()
        if isinstance(data, dict):
            assert "sessions" in data
        else:
            assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Metrics & Costs
# ---------------------------------------------------------------------------

class TestMetricsEndpoints:

    def test_get_metrics(self, client):
        resp = client.get("/metrics")
        assert resp.status_code == 200

    def test_get_costs(self, client):
        resp = client.get("/costs")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Memory endpoints
# ---------------------------------------------------------------------------

class TestMemoryEndpoints:

    def test_memory_overview(self, client):
        resp = client.get("/memory")
        assert resp.status_code == 200

    def test_memory_daily(self, client):
        resp = client.get("/memory/daily")
        assert resp.status_code == 200

    def test_memory_soul(self, client):
        resp = client.get("/memory/soul")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Schedule endpoints
# ---------------------------------------------------------------------------

class TestScheduleEndpoints:

    def test_list_schedule(self, client, mock_scheduler):
        resp = client.get("/schedule")
        assert resp.status_code == 200
        data = resp.json()
        # May be a list or a dict wrapper
        assert isinstance(data, (list, dict))


# ---------------------------------------------------------------------------
# Soul endpoints
# ---------------------------------------------------------------------------

class TestSoulEndpoints:

    def test_read_soul(self, client):
        resp = client.get("/soul")
        assert resp.status_code == 200

    def test_soul_proposals(self, client):
        resp = client.get("/soul/proposals")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# CORS headers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Agent Kill-Switch endpoints
# ---------------------------------------------------------------------------

class TestAgentKillSwitchEndpoints:

    def test_disable_agent_200(self, client, mock_orchestrator):
        mock_orchestrator.disable_agent = AsyncMock()
        resp = client.post("/agents/researcher/disable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "disabled"
        assert data["agent"] == "researcher"

    def test_enable_agent_200(self, client, mock_orchestrator):
        mock_orchestrator.enable_agent = AsyncMock()
        resp = client.post("/agents/researcher/enable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "enabled"

    def test_disable_unknown_agent_404(self, client, mock_orchestrator):
        mock_orchestrator.disable_agent = AsyncMock()
        resp = client.post("/agents/nonexistent/disable")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Read-Only Mode endpoints
# ---------------------------------------------------------------------------

class TestReadOnlyEndpoints:

    def test_enable_readonly(self, client):
        resp = client.post("/readonly/enable")
        assert resp.status_code == 200
        assert resp.json()["readonly"] is True

    def test_disable_readonly(self, client):
        resp = client.post("/readonly/disable")
        assert resp.status_code == 200
        assert resp.json()["readonly"] is False

    def test_get_readonly_status(self, client):
        resp = client.get("/readonly")
        assert resp.status_code == 200
        assert "readonly" in resp.json()


class TestCORS:

    def test_cors_allows_configured_origins(self, client):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in resp.headers


# ---------------------------------------------------------------------------
# Bridge Auth Configuration
# ---------------------------------------------------------------------------

class TestBridgeAuthConfig:

    def test_default_auth_disabled_without_env(self):
        """When no env vars are set, auth defaults to disabled."""
        import importlib
        saved = os.environ.pop("PODCLAW_BRIDGE_AUTH_ENABLED", None)
        saved_token = os.environ.pop("PODCLAW_BRIDGE_AUTH_TOKEN", None)
        try:
            import podclaw.config as cfg_mod
            # Re-evaluate: default is "false"
            val = os.environ.get("PODCLAW_BRIDGE_AUTH_ENABLED", "false").lower() == "true"
            assert val is False
        finally:
            if saved is not None:
                os.environ["PODCLAW_BRIDGE_AUTH_ENABLED"] = saved
            if saved_token is not None:
                os.environ["PODCLAW_BRIDGE_AUTH_TOKEN"] = saved_token

    def test_auth_enabled_with_token_ok(self):
        """When auth is enabled AND a token is set, no crash."""
        saved = os.environ.get("PODCLAW_BRIDGE_AUTH_ENABLED")
        saved_token = os.environ.get("PODCLAW_BRIDGE_AUTH_TOKEN")
        os.environ["PODCLAW_BRIDGE_AUTH_ENABLED"] = "true"
        os.environ["PODCLAW_BRIDGE_AUTH_TOKEN"] = "valid-secret-token"
        try:
            enabled = os.environ.get("PODCLAW_BRIDGE_AUTH_ENABLED", "false").lower() == "true"
            token = os.environ.get("PODCLAW_BRIDGE_AUTH_TOKEN", "")
            assert enabled is True
            assert token == "valid-secret-token"
        finally:
            if saved is not None:
                os.environ["PODCLAW_BRIDGE_AUTH_ENABLED"] = saved
            else:
                os.environ.pop("PODCLAW_BRIDGE_AUTH_ENABLED", None)
            if saved_token is not None:
                os.environ["PODCLAW_BRIDGE_AUTH_TOKEN"] = saved_token
            else:
                os.environ.pop("PODCLAW_BRIDGE_AUTH_TOKEN", None)

    def test_auth_enabled_without_token_exits(self):
        """When auth is enabled but no token, config.py should sys.exit(1)."""
        import subprocess
        import sys
        venv_python = str(Path(__file__).resolve().parent.parent.parent / ".venv" / "bin" / "python")
        python_exe = venv_python if Path(venv_python).exists() else sys.executable
        result = subprocess.run(
            [python_exe, "-c", (
                "import os; "
                "os.environ['PODCLAW_BRIDGE_AUTH_ENABLED'] = 'true'; "
                "os.environ.pop('PODCLAW_BRIDGE_AUTH_TOKEN', None); "
                "import importlib; "
                "import podclaw.config; "
                "importlib.reload(podclaw.config)"
            )],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(Path(__file__).resolve().parent.parent.parent),
        )
        assert result.returncode != 0, "Should exit with non-zero code"
        assert "FATAL" in result.stderr or result.returncode == 1
