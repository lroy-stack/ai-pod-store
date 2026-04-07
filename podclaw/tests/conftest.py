"""
PodClaw Test Fixtures
======================
Shared fixtures for unit, component, integration, and E2E tests.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Stub external dependencies that aren't available locally
# ---------------------------------------------------------------------------
import sys
import types

def _ensure_stub(module_name: str, attrs: dict | None = None):
    """Register a stub module if the real one isn't installed."""
    if module_name not in sys.modules:
        mod = types.ModuleType(module_name)
        for k, v in (attrs or {}).items():
            setattr(mod, k, v)
        sys.modules[module_name] = mod

# claude_agent_sdk — only available in Docker runtime
_ensure_stub("claude_agent_sdk", {
    "ClaudeSDKClient": type("ClaudeSDKClient", (), {}),
    "ClaudeAgentOptions": type("ClaudeAgentOptions", (), {"__init__": lambda self, **kw: None}),
    "McpSdkServerConfig": dict,
    "SandboxSettings": type("SandboxSettings", (), {"__init__": lambda self, **kw: None}),
    "HookMatcher": type("HookMatcher", (), {
        "__init__": lambda self, matcher=None, hooks=None, **kw: (
            setattr(self, "matcher", matcher) or setattr(self, "hooks", hooks or [])
        ),
    }),
    "PermissionResultAllow": type("PermissionResultAllow", (), {"__init__": lambda self, **kw: None}),
    "PermissionResultDeny": type("PermissionResultDeny", (), {
        "__init__": lambda self, message="", **kw: setattr(self, "message", message) or None,
    }),
    "ToolPermissionContext": type("ToolPermissionContext", (), {}),
    "ResultMessage": type("ResultMessage", (), {}),
})

# redis — only available in Docker runtime
_ensure_stub("redis")
_ensure_stub("redis.asyncio")

# ---------------------------------------------------------------------------
# Standard imports
# ---------------------------------------------------------------------------

import asyncio
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Markers & pytest-asyncio config
# ---------------------------------------------------------------------------

def pytest_configure(config):
    config.addinivalue_line("markers", "unit: fast unit tests")
    config.addinivalue_line("markers", "integration: tests that need mock servers")
    config.addinivalue_line("markers", "e2e: end-to-end tests with full pipeline")


# ---------------------------------------------------------------------------
# Workspace & Memory
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_workspace(tmp_path: Path) -> Path:
    """Temporary directory structure mimicking PodClaw's workspace."""
    (tmp_path / "memory").mkdir()
    (tmp_path / "memory" / "weekly").mkdir()
    (tmp_path / "memory" / "context").mkdir()
    (tmp_path / "project" / "podclaw" / "skills" / "researcher").mkdir(parents=True)
    (tmp_path / "project" / "podclaw" / "skills" / "designer").mkdir(parents=True)
    (tmp_path / "project" / "podclaw" / "catalog").mkdir(parents=True)

    # Create minimal SOUL.md
    soul = tmp_path / "project" / "podclaw" / "SOUL.md"
    soul.write_text("# PodClaw Soul\n\n## Identity\nI am PodClaw.\n")

    # Create minimal SKILL.md for researcher
    skill = tmp_path / "project" / "podclaw" / "skills" / "researcher" / "SKILL.md"
    skill.write_text("# Researcher\nResearch market trends.\n")

    return tmp_path


@pytest.fixture()
def memory_manager(tmp_workspace: Path):
    """MemoryManager backed by tmp_workspace."""
    from podclaw.memory_manager import MemoryManager

    mm = MemoryManager(workspace_dir=tmp_workspace)
    mm.memory_dir = tmp_workspace / "memory"
    mm.weekly_dir = tmp_workspace / "memory" / "weekly"
    mm.context_dir = tmp_workspace / "memory" / "context"
    mm.memory_path = tmp_workspace / "memory" / "MEMORY.md"
    mm.soul_path = tmp_workspace / "project" / "podclaw" / "SOUL.md"
    mm.weekly_dir.mkdir(parents=True, exist_ok=True)
    mm.context_dir.mkdir(parents=True, exist_ok=True)
    return mm


# ---------------------------------------------------------------------------
# State Store (SQLite in tmpdir)
# ---------------------------------------------------------------------------

@pytest.fixture()
def state_store(tmp_path: Path):
    """StateStore backed by SQLite in tmp_path."""
    from podclaw.state_store import StateStore
    return StateStore(tmp_path / "test_state.db")


# ---------------------------------------------------------------------------
# Event Store (no Supabase)
# ---------------------------------------------------------------------------

@pytest.fixture()
def event_store():
    """EventStore without Supabase — logs locally only."""
    from podclaw.event_store import EventStore
    return EventStore(supabase_client=None)


# ---------------------------------------------------------------------------
# Mock Supabase Client
# ---------------------------------------------------------------------------

class MockSupabaseTable:
    """Chainable mock for Supabase table operations."""

    def __init__(self, data=None):
        self._data = data or []
        self._response = MagicMock()
        self._response.data = self._data
        self._response.count = len(self._data)

    def select(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def upsert(self, *args, **kwargs):
        return self

    def delete(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def lte(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        return self._response


class MockSupabaseClient:
    """Minimal Supabase client mock."""

    def __init__(self):
        self._tables: dict[str, MockSupabaseTable] = {}
        self._default_table = MockSupabaseTable()

    def table(self, name: str) -> MockSupabaseTable:
        return self._tables.get(name, self._default_table)

    def set_table_data(self, table_name: str, data: list[dict]):
        self._tables[table_name] = MockSupabaseTable(data)


@pytest.fixture()
def mock_supabase():
    """Mock Supabase client with chainable table operations."""
    return MockSupabaseClient()


# ---------------------------------------------------------------------------
# Event Queue
# ---------------------------------------------------------------------------

@pytest.fixture()
def event_queue():
    """SystemEventQueue without Supabase."""
    from podclaw.event_queue import SystemEventQueue
    return SystemEventQueue(supabase_client=None)


# ---------------------------------------------------------------------------
# Sample Hook Payloads
# ---------------------------------------------------------------------------

@pytest.fixture()
def sample_tool_use():
    """Sample PreToolUse hook input payload."""
    return {
        "tool_name": "supabase_query",
        "tool_input": {"table": "products", "select": "*"},
        "_agent_name": "researcher",
        "_session_id": "test-session-001",
    }


@pytest.fixture()
def sample_tool_result():
    """Sample PostToolUse hook input payload."""
    return {
        "tool_name": "supabase_query",
        "tool_input": {"table": "products", "select": "*"},
        "tool_output": '{"data": [{"id": "abc", "title": "Test Product"}]}',
        "_agent_name": "researcher",
        "_session_id": "test-session-001",
    }


# ---------------------------------------------------------------------------
# Reset hook module-level state between tests
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_hook_state():
    """Reset global state in hook modules to prevent test pollution."""
    yield
    # Post-test cleanup
    try:
        from podclaw.hooks.cost_guard_hook import _daily_costs
        _daily_costs.clear()
    except ImportError:
        pass
    try:
        from podclaw.hooks.rate_limit_hook import _counters
        _counters.clear()
    except ImportError:
        pass
    try:
        from podclaw.hooks.metrics_hook import _metrics, _pending_timers
        _metrics.clear()
        _pending_timers.clear()
    except ImportError:
        pass
    try:
        import podclaw.hooks.security_hook as _sh
        _sh._daily_refund_total = 0.0
        _sh._daily_refund_date = None
        _sh._read_only_mode = False
    except ImportError:
        pass
