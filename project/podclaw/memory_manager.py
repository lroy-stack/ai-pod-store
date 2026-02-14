"""
PodClaw — Memory Manager
==========================

Three-tier memory consolidation:
  Tier 1: Daily (memory/{YYYY-MM-DD}.md) — every session, 14 days retention
  Tier 2: Weekly (memory/weekly/{YYYY-W##}.md) — consolidated Sunday, 90 days
  Tier 3: Long-term (memory/MEMORY.md) — durable facts, never pruned
  Plus:   Context (memory/context/*.md) — working memory, never pruned
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import structlog

from podclaw.config import DAILY_LOG_RETENTION_DAYS, WEEKLY_LOG_RETENTION_DAYS

logger = structlog.get_logger(__name__)


class MemoryManager:
    """Manages PodClaw's three-tier memory system."""

    def __init__(self, workspace_dir: Path):
        self.workspace = workspace_dir
        self.memory_dir = workspace_dir / "memory"
        self.context_dir = self.memory_dir / "context"
        self.weekly_dir = self.memory_dir / "weekly"
        self.soul_path = Path(__file__).parent / "SOUL.md"
        self.memory_path = self.memory_dir / "MEMORY.md"

        # Ensure directories exist
        self.context_dir.mkdir(parents=True, exist_ok=True)
        self.weekly_dir.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # Daily Log
    # -----------------------------------------------------------------------

    def _daily_log_path(self, date: datetime | None = None) -> Path:
        dt = date or datetime.now(timezone.utc)
        return self.memory_dir / f"{dt.strftime('%Y-%m-%d')}.md"

    async def append_daily(self, agent_name: str, summary: str) -> None:
        """Append an entry to today's daily log."""
        path = self._daily_log_path()
        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%H:%M:%S")

        if not path.exists():
            path.write_text(f"# Daily Log — {now.strftime('%Y-%m-%d')}\n\n")

        with open(path, "a") as f:
            f.write(f"## [{timestamp}] {agent_name}\n{summary}\n\n")

        logger.debug("daily_log_appended", agent=agent_name, path=str(path))

    # -----------------------------------------------------------------------
    # Context Files
    # -----------------------------------------------------------------------

    def read_context(self, filename: str) -> str:
        """Read a context file. Returns empty string if not found."""
        path = self.context_dir / filename
        if path.exists():
            return path.read_text()
        return ""

    async def update_context(self, filename: str, content: str) -> None:
        """Update a context file (full replace)."""
        path = self.context_dir / filename
        path.write_text(content)
        logger.debug("context_updated", file=filename)

    async def append_context(self, filename: str, entry: str) -> None:
        """Append to a context file."""
        path = self.context_dir / filename
        with open(path, "a") as f:
            f.write(entry + "\n")

    # -----------------------------------------------------------------------
    # SOUL.md
    # -----------------------------------------------------------------------

    def read_soul(self) -> str:
        """Read the agent identity file."""
        if self.soul_path.exists():
            return self.soul_path.read_text()
        return ""

    # -----------------------------------------------------------------------
    # MEMORY.md (Long-term)
    # -----------------------------------------------------------------------

    def read_memory(self) -> str:
        """Read long-term memory."""
        if self.memory_path.exists():
            return self.memory_path.read_text()
        return ""

    async def append_memory(self, fact: str) -> None:
        """Append a durable fact to long-term memory."""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with open(self.memory_path, "a") as f:
            f.write(f"- [{now}] {fact}\n")

    # -----------------------------------------------------------------------
    # Weekly Consolidation
    # -----------------------------------------------------------------------

    def _weekly_path(self, date: datetime | None = None) -> Path:
        dt = date or datetime.now(timezone.utc)
        year, week, _ = dt.isocalendar()
        return self.weekly_dir / f"{year}-W{week:02d}.md"

    async def consolidate_daily_to_weekly(self) -> None:
        """
        Extract key actions from today's daily log and append summarized to weekly.
        Called at 23:30 UTC.
        """
        today = datetime.now(timezone.utc)
        daily_path = self._daily_log_path(today)

        if not daily_path.exists():
            logger.info("consolidation_skip_no_daily", date=today.strftime("%Y-%m-%d"))
            return

        daily_content = daily_path.read_text()
        weekly_path = self._weekly_path(today)

        if not weekly_path.exists():
            year, week, _ = today.isocalendar()
            weekly_path.write_text(f"# Weekly Summary — {year}-W{week:02d}\n\n")

        # Extract only action lines (lines starting with "- " under agent headers)
        summary_lines = []
        current_agent = ""
        for line in daily_content.splitlines():
            if line.startswith("## ["):
                # Agent header: ## [HH:MM:SS] agent_name
                current_agent = line.split("]", 1)[-1].strip()
            elif line.startswith("- ") and current_agent:
                summary_lines.append(f"  {line}")
            elif line.startswith("Session ") and "completed" in line:
                summary_lines.append(f"  - {line.strip()}")

        with open(weekly_path, "a") as f:
            f.write(f"\n## {today.strftime('%Y-%m-%d')}\n")
            if summary_lines:
                f.write("\n".join(summary_lines) + "\n")
            else:
                f.write("No significant actions recorded.\n")

        logger.info("daily_consolidated_to_weekly", daily=str(daily_path), weekly=str(weekly_path),
                     action_count=len(summary_lines))

    async def consolidate_weekly_to_memory(self) -> None:
        """
        Summarize current weekly into MEMORY.md.
        Called every Sunday.
        """
        today = datetime.now(timezone.utc)
        weekly_path = self._weekly_path(today)

        if not weekly_path.exists():
            return

        weekly_content = weekly_path.read_text()

        # Append summary marker to MEMORY.md
        year, week, _ = today.isocalendar()
        await self.append_memory(f"Week {year}-W{week:02d} consolidated. See weekly/{weekly_path.name}")

        logger.info("weekly_consolidated_to_memory", weekly=str(weekly_path))

    # -----------------------------------------------------------------------
    # Pruning
    # -----------------------------------------------------------------------

    async def prune_old_logs(self) -> dict[str, int]:
        """
        Prune daily logs > 14 days, weekly logs > 90 days.
        Context files are NEVER pruned.

        Returns count of pruned files.
        """
        now = datetime.now(timezone.utc)
        pruned = {"daily": 0, "weekly": 0}

        # Prune daily logs
        daily_cutoff = now - timedelta(days=DAILY_LOG_RETENTION_DAYS)
        for f in self.memory_dir.glob("????-??-??.md"):
            try:
                file_date = datetime.strptime(f.stem, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if file_date < daily_cutoff:
                    f.unlink()
                    pruned["daily"] += 1
            except ValueError:
                continue

        # Prune weekly logs
        weekly_cutoff = now - timedelta(days=WEEKLY_LOG_RETENTION_DAYS)
        for f in self.weekly_dir.glob("????-W??.md"):
            try:
                # Parse ISO week: YYYY-Www
                parts = f.stem.split("-W")
                year, week = int(parts[0]), int(parts[1])
                file_date = datetime.fromisocalendar(year, week, 1).replace(tzinfo=timezone.utc)
                if file_date < weekly_cutoff:
                    f.unlink()
                    pruned["weekly"] += 1
            except (ValueError, IndexError):
                continue

        if pruned["daily"] or pruned["weekly"]:
            logger.info("memory_pruned", **pruned)

        return pruned

    # -----------------------------------------------------------------------
    # Full Consolidation (23:30 UTC)
    # -----------------------------------------------------------------------

    async def run_consolidation(self) -> None:
        """
        Full consolidation cycle:
        1. Daily → Weekly
        2. If Sunday: Weekly → MEMORY.md
        3. Prune old logs
        """
        await self.consolidate_daily_to_weekly()

        today = datetime.now(timezone.utc)
        if today.weekday() == 6:  # Sunday
            await self.consolidate_weekly_to_memory()

        await self.prune_old_logs()
        logger.info("consolidation_complete")

    # -----------------------------------------------------------------------
    # Agent Context Loader
    # -----------------------------------------------------------------------

    def load_agent_context(self, agent_name: str, context_files: list[str]) -> str:
        """
        Build context string for a sub-agent from SOUL.md + relevant context files.
        """
        parts = []

        soul = self.read_soul()
        if soul:
            parts.append(f"# Identity\n{soul}")

        memory = self.read_memory()
        if memory:
            parts.append(f"# Long-term Memory\n{memory}")

        for filename in context_files:
            content = self.read_context(filename)
            if content:
                parts.append(f"# Context: {filename}\n{content}")

        return "\n\n---\n\n".join(parts)
