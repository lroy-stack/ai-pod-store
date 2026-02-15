"""
PodClaw — Memory Manager
==========================

Three-tier memory consolidation:
  Tier 1: Daily (memory/{YYYY-MM-DD}.md) — every session, 14 days retention
  Tier 2: Weekly (memory/weekly/{YYYY-W##}.md) — consolidated Sunday, 90 days
  Tier 3: Long-term (memory/MEMORY.md) — durable facts, never pruned
  Plus:   Context (memory/context/*.md) — working memory, never pruned
  Plus:   Heartbeat (memory/HEARTBEAT.md) — mutable checklist for heartbeat runner

Agentic consolidation: daily→weekly and weekly→MEMORY.md are LLM-summarized
(Sonnet), with mechanical extraction as fallback.
"""

from __future__ import annotations

import asyncio
import os
import re
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import structlog

from podclaw.config import (
    CONSOLIDATION_MAX_TOKENS,
    CONSOLIDATION_MODEL,
    DAILY_LOG_RETENTION_DAYS,
    WEEKLY_LOG_RETENTION_DAYS,
)

logger = structlog.get_logger(__name__)

_CONTEXT_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_-]+\.md$")

# Max bytes of MEMORY.md to load into agent system prompts (prevent unbounded growth)
_MEMORY_LOAD_MAX_BYTES = 4096

# Patterns that should never appear in agent-written context/memory data.
# These are common prompt injection vectors.
_INJECTION_PATTERNS = re.compile(
    r"(?i)"
    r"(?:ignore (?:all |the )?(?:previous|above|prior) (?:instructions?|rules?|prompts?))"
    r"|(?:you are now|new role|act as|pretend (?:to be|you are))"
    r"|(?:system ?prompt|<\|?(?:system|im_start)\|?>)"
    r"|(?:override (?:all |the )?(?:rules?|constraints?|guardrails?))"
    r"|(?:reveal (?:your |the )?(?:system|prompt|instructions?))"
)


def _sanitize_data(text: str) -> str:
    """Strip potential prompt injection patterns from agent-written data."""
    cleaned = _INJECTION_PATTERNS.sub("[REDACTED:injection_attempt]", text)
    if cleaned != text:
        logger.warning("injection_pattern_redacted", original_len=len(text))
    return cleaned


def _atomic_write(path: Path, content: str) -> None:
    """Write file atomically: write to temp, then os.replace().

    Prevents partial reads during concurrent access.
    os.replace() is atomic on POSIX systems.
    """
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=str(path.parent),
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, str(path))
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


class MemoryManager:
    """Manages PodClaw's three-tier memory system."""

    def __init__(self, workspace_dir: Path):
        self.workspace = workspace_dir
        self.memory_dir = workspace_dir / "memory"
        self.context_dir = self.memory_dir / "context"
        self.weekly_dir = self.memory_dir / "weekly"
        self.soul_path = Path(__file__).parent / "SOUL.md"
        self.memory_path = self.memory_dir / "MEMORY.md"

        self._write_lock = asyncio.Lock()

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
        """Append an entry to today's daily log. Sanitizes for injection."""
        async with self._write_lock:
            path = self._daily_log_path()
            now = datetime.now(timezone.utc)
            timestamp = now.strftime("%H:%M:%S")

            existing = ""
            if path.exists():
                existing = path.read_text()
            else:
                existing = f"# Daily Log — {now.strftime('%Y-%m-%d')}\n\n"

            new_content = existing + f"## [{timestamp}] {agent_name}\n{_sanitize_data(summary)}\n\n"
            _atomic_write(path, new_content)

            logger.debug("daily_log_appended", agent=agent_name, path=str(path))

    def read_daily_tail(self, lines: int = 100) -> str:
        """Read the last N lines of today's daily log."""
        path = self._daily_log_path()
        if not path.exists():
            return ""
        all_lines = path.read_text().splitlines()
        return "\n".join(all_lines[-lines:])

    # -----------------------------------------------------------------------
    # Context Files
    # -----------------------------------------------------------------------

    def _safe_context_path(self, filename: str) -> Path:
        """Validate and resolve a context filename safely."""
        if not _CONTEXT_FILENAME_RE.match(filename):
            raise ValueError(f"Invalid context filename: {filename}")
        path = (self.context_dir / filename).resolve()
        if not path.is_relative_to(self.context_dir.resolve()):
            raise ValueError(f"Path traversal detected: {filename}")
        return path

    def read_context(self, filename: str) -> str:
        """Read a context file. Returns empty string if not found."""
        try:
            path = self._safe_context_path(filename)
        except ValueError:
            return ""
        if path.exists():
            return path.read_text()
        return ""

    async def update_context(self, filename: str, content: str) -> None:
        """Update a context file (full replace). Sanitizes for injection."""
        async with self._write_lock:
            path = self._safe_context_path(filename)
            _atomic_write(path, _sanitize_data(content))
            logger.debug("context_updated", file=filename)

    async def append_context(self, filename: str, entry: str) -> None:
        """Append to a context file. Sanitizes for injection."""
        async with self._write_lock:
            path = self._safe_context_path(filename)
            existing = path.read_text() if path.exists() else ""
            _atomic_write(path, existing + _sanitize_data(entry) + "\n")

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
        fact = _sanitize_data(fact)
        async with self._write_lock:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            existing = self.memory_path.read_text() if self.memory_path.exists() else ""
            _atomic_write(self.memory_path, existing + f"- [{now}] {fact}\n")

    # -----------------------------------------------------------------------
    # HEARTBEAT.md
    # -----------------------------------------------------------------------

    @property
    def heartbeat_path(self) -> Path:
        return self.memory_dir / "HEARTBEAT.md"

    def read_heartbeat(self) -> str:
        """Read the heartbeat checklist."""
        if self.heartbeat_path.exists():
            return self.heartbeat_path.read_text()
        return ""

    async def update_heartbeat(self, content: str) -> None:
        """Update the heartbeat checklist (full replace)."""
        async with self._write_lock:
            _atomic_write(self.heartbeat_path, content)
            logger.debug("heartbeat_updated")

    # -----------------------------------------------------------------------
    # Transcript Archiving (PreCompact hook)
    # -----------------------------------------------------------------------

    async def archive_transcript(self, session_id: str, content: str) -> None:
        """Archive transcript to conversations/ before SDK compaction."""
        conversations_dir = self.memory_dir / "conversations"
        conversations_dir.mkdir(parents=True, exist_ok=True)

        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = f"{date}-{session_id[:8]}.jsonl"
        filepath = conversations_dir / filename

        async with self._write_lock:
            _atomic_write(filepath, content)
            logger.info("transcript_archived", session_id=session_id[:8], path=str(filepath))

    # -----------------------------------------------------------------------
    # Weekly Consolidation
    # -----------------------------------------------------------------------

    def _weekly_path(self, date: datetime | None = None) -> Path:
        dt = date or datetime.now(timezone.utc)
        year, week, _ = dt.isocalendar()
        return self.weekly_dir / f"{year}-W{week:02d}.md"

    async def consolidate_daily_to_weekly(self) -> None:
        """
        Summarize today's daily log into the weekly file using LLM (Sonnet).
        Falls back to mechanical extraction if LLM fails.
        Called at 23:30 UTC.
        """
        today = datetime.now(timezone.utc)
        daily_path = self._daily_log_path(today)

        if not daily_path.exists():
            logger.info("consolidation_skip_no_daily", date=today.strftime("%Y-%m-%d"))
            return

        daily_content = daily_path.read_text()
        if len(daily_content.strip()) < 50:
            logger.info("consolidation_skip_short_daily", date=today.strftime("%Y-%m-%d"))
            return

        # Try LLM summarization first (outside lock — network call)
        try:
            summary = await self._llm_summarize_daily(daily_content, today)
            logger.info("daily_consolidated_agentic", date=today.strftime("%Y-%m-%d"))
        except Exception as e:
            logger.warning("llm_consolidation_failed_fallback", error=str(e))
            summary = self._mechanical_extract(daily_content)

        async with self._write_lock:
            weekly_path = self._weekly_path(today)

            if weekly_path.exists():
                existing = weekly_path.read_text()
            else:
                year, week, _ = today.isocalendar()
                existing = f"# Weekly Summary — {year}-W{week:02d}\n\n"

            _atomic_write(weekly_path, existing + f"\n## {today.strftime('%Y-%m-%d')}\n{summary}\n")

        logger.info("daily_consolidated_to_weekly", daily=str(daily_path), weekly=str(weekly_path))

    async def consolidate_weekly_to_memory(self) -> None:
        """
        Extract durable learnings from the weekly file into MEMORY.md using LLM.
        Falls back to a simple marker if LLM fails.
        Called every Sunday.
        """
        today = datetime.now(timezone.utc)
        weekly_path = self._weekly_path(today)

        if not weekly_path.exists():
            return

        weekly_content = weekly_path.read_text()
        current_memory = self.read_memory()

        # LLM call outside lock — network call
        try:
            new_facts = await self._llm_extract_learnings(weekly_content, current_memory)
            logger.info("weekly_consolidated_agentic")
        except Exception as e:
            logger.warning("llm_extraction_failed_fallback", error=str(e))
            year, week, _ = today.isocalendar()
            new_facts = f"- Week {year}-W{week:02d} consolidated. See weekly/{weekly_path.name}"

        async with self._write_lock:
            existing = self.memory_path.read_text() if self.memory_path.exists() else ""
            new_facts = _sanitize_data(new_facts)
            _atomic_write(self.memory_path, existing + f"\n\n## Week Learnings\n{new_facts}\n")

        logger.info("weekly_consolidated_to_memory", weekly=str(weekly_path))

    # -----------------------------------------------------------------------
    # LLM Consolidation Helpers
    # -----------------------------------------------------------------------

    async def _llm_summarize_daily(self, daily_content: str, date: datetime) -> str:
        """Use Sonnet to summarize a day's agent activity log."""
        import anthropic

        client = anthropic.AsyncAnthropic()

        # Truncate to keep costs low
        truncated = daily_content[:8000]

        response = await client.messages.create(
            model=CONSOLIDATION_MODEL,
            max_tokens=CONSOLIDATION_MAX_TOKENS,
            system=(
                "You are PodClaw's memory consolidation system for a POD e-commerce store. "
                "Summarize the day's agent activities into concise bullet points. "
                "Focus on: key actions taken, patterns observed, metrics/numbers, "
                "follow-up items needed. Max 20 bullet points. Use '- ' prefix for each."
            ),
            messages=[{
                "role": "user",
                "content": f"Summarize this daily log for {date.strftime('%Y-%m-%d')}:\n\n{truncated}",
            }],
        )

        return response.content[0].text

    async def _llm_extract_learnings(self, weekly_content: str, current_memory: str) -> str:
        """Use Sonnet to extract durable facts from weekly log, avoiding duplicates."""
        import anthropic

        client = anthropic.AsyncAnthropic()

        truncated_weekly = weekly_content[:8000]
        truncated_memory = current_memory[:4000]

        response = await client.messages.create(
            model=CONSOLIDATION_MODEL,
            max_tokens=CONSOLIDATION_MAX_TOKENS,
            system=(
                "You are PodClaw's long-term memory extraction system. "
                "Extract durable facts and learnings from the weekly summary. "
                "Categorize each as: [Pattern], [Learning], [Opinion c=0-100], or [Fact]. "
                "Compare against existing MEMORY.md to avoid duplicates. "
                "Output only new/updated entries. Use '- ' prefix for each. "
                "Max 15 entries."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"## Current MEMORY.md\n{truncated_memory}\n\n"
                    f"## This Week's Summary\n{truncated_weekly}\n\n"
                    "Extract new durable learnings:"
                ),
            }],
        )

        return response.content[0].text

    def _mechanical_extract(self, daily_content: str) -> str:
        """
        Fallback: extract action lines mechanically (no LLM).
        Used when the LLM call fails.
        """
        summary_lines = []
        current_agent = ""
        for line in daily_content.splitlines():
            if line.startswith("## ["):
                current_agent = line.split("]", 1)[-1].strip()
            elif line.startswith("- ") and current_agent:
                summary_lines.append(f"  {line}")
            elif line.startswith("Session ") and "completed" in line:
                summary_lines.append(f"  - {line.strip()}")

        if summary_lines:
            return "\n".join(summary_lines)
        return "No significant actions recorded."

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
        1. Daily → Weekly (LLM-summarized)
        2. If Sunday: Weekly → MEMORY.md (LLM-extracted)
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

        All data sections are wrapped in [DATA]...[/DATA] boundary markers to
        clearly separate trusted instructions from reference data.
        MEMORY.md is capped at _MEMORY_LOAD_MAX_BYTES to prevent unbounded growth.
        """
        parts = []

        soul = self.read_soul()
        if soul:
            parts.append(f"# Identity\n[DATA source=SOUL.md]\n{soul}\n[/DATA]")

        memory = self.read_memory()
        if memory:
            # Cap memory to prevent unbounded prompt growth
            if len(memory) > _MEMORY_LOAD_MAX_BYTES:
                memory = memory[-_MEMORY_LOAD_MAX_BYTES:]
                # Find first newline to avoid cutting mid-line
                nl = memory.find("\n")
                if nl > 0:
                    memory = memory[nl + 1:]
                memory = f"(truncated — showing last {_MEMORY_LOAD_MAX_BYTES} bytes)\n{memory}"
            parts.append(f"# Long-term Memory\n[DATA source=MEMORY.md]\n{memory}\n[/DATA]")

        for filename in context_files:
            content = self.read_context(filename)
            if content:
                parts.append(
                    f"# Context: {filename}\n[DATA source={filename}]\n{content}\n[/DATA]"
                )

        return "\n\n---\n\n".join(parts)
