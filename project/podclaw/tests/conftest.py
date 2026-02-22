"""
PodClaw Test Fixtures
"""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture()
def tmp_workspace(tmp_path: Path) -> Path:
    """Create a temporary directory structure mimicking PodClaw's workspace.

    Layout:
        tmp_path/
            memory/
                weekly/
            context/
    """
    (tmp_path / "memory").mkdir()
    (tmp_path / "memory" / "weekly").mkdir()
    (tmp_path / "context").mkdir()
    return tmp_path


@pytest.fixture()
def memory_manager(tmp_workspace: Path):
    """Create a MemoryManager instance backed by the tmp_workspace.

    Patches internal directory paths so all file I/O stays inside tmp_path.
    """
    from podclaw.memory_manager import MemoryManager

    mm = MemoryManager(workspace_dir=tmp_workspace)

    # Override directory paths to point at the temporary workspace
    mm.memory_dir = tmp_workspace / "memory"
    mm.weekly_dir = tmp_workspace / "memory" / "weekly"
    mm.context_dir = tmp_workspace / "context"
    mm.memory_path = tmp_workspace / "memory" / "MEMORY.md"

    # Ensure directories exist (in case MemoryManager.__init__ didn't create them
    # under our overridden paths)
    mm.weekly_dir.mkdir(parents=True, exist_ok=True)
    mm.context_dir.mkdir(parents=True, exist_ok=True)

    return mm
