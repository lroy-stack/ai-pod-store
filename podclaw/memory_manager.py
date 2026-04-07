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
    CONTEXT_FILE_MAX_LINES,
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
    """Strip potential prompt injection patterns from agent-written data.

    Also normalizes Unicode (NFKC) to collapse fullwidth/homoglyph evasion vectors
    like 'ＩＧＮＯＲＥ previous' → 'IGNORE previous'.
    """
    import unicodedata
    text = unicodedata.normalize('NFKC', text)
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
        _podclaw_root = Path(__file__).parent                 # project/podclaw/
        self.memory_dir = _podclaw_root / "memory"            # project/podclaw/memory/
        self.context_dir = _podclaw_root / "context"          # project/podclaw/context/ (already exists)
        self.catalog_dir = _podclaw_root / "catalog"          # project/podclaw/catalog/ (read-only reference)
        self.weekly_dir = self.memory_dir / "weekly"           # project/podclaw/memory/weekly/
        self.soul_path = _podclaw_root / "SOUL.md"            # project/podclaw/SOUL.md (unchanged)
        self.memory_path = self.memory_dir / "MEMORY.md"      # project/podclaw/memory/MEMORY.md

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

    async def append_daily(self, agent_name: str, summary: str, high_signal: bool = False) -> None:
        """Append an entry to today's daily log. Sanitizes for injection.

        If high_signal=True, also writes to MEMORY.md directly for cross-session
        visibility (e.g. anomalies, pricing problems, sync mismatches).

        Pollution filters:
        - Too short (<10 chars): skip
        - Too long (>5000 chars): truncate
        - Near-duplicate of recent entry from same agent: skip
        """
        stripped = summary.strip()
        if len(stripped) < 10:
            logger.debug("daily_log_skip_too_short", agent=agent_name, length=len(stripped))
            return
        if len(stripped) > 5000:
            stripped = stripped[:5000] + "\n[TRUNCATED]"

        async with self._write_lock:
            path = self._daily_log_path()
            now = datetime.now(timezone.utc)
            timestamp = now.strftime("%H:%M:%S")

            existing = ""
            if path.exists():
                existing = path.read_text()
            else:
                existing = f"# Daily Log — {now.strftime('%Y-%m-%d')}\n\n"

            # Near-duplicate detection: same agent + same first 100 chars in recent entries
            prefix = stripped[:100]
            recent_chunks = existing.split("## [")[-5:]
            for chunk in recent_chunks:
                if agent_name in chunk and prefix in chunk:
                    logger.debug("daily_log_skip_duplicate", agent=agent_name)
                    return

            sanitized = _sanitize_data(stripped)
            new_content = existing + f"## [{timestamp}] {agent_name}\n{sanitized}\n\n"
            _atomic_write(path, new_content)

            logger.debug("daily_log_appended", agent=agent_name, path=str(path))

        # High-signal entries also go to MEMORY.md (separate lock acquisition)
        if high_signal:
            await self.append_memory(f"[{agent_name}] {summary[:200]}")

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

    async def update_context(self, filename: str, content: str, expected_hash: str | None = None) -> None:
        """Update a context file (full replace). Sanitizes for injection.

        If expected_hash is provided (CAS mode), checks that the current file hash
        matches before overwriting. On mismatch, merges with a conflict marker
        instead of blindly overwriting.
        """
        async with self._write_lock:
            path = self._safe_context_path(filename)
            if expected_hash and path.exists():
                import hashlib
                current = path.read_text()
                current_hash = hashlib.sha256(current.encode()).hexdigest()[:16]
                if current_hash != expected_hash:
                    # Merge: keep current + append new with conflict marker
                    merged = current.rstrip() + "\n\n<!-- MERGE: concurrent update detected -->\n" + _sanitize_data(content)
                    _atomic_write(path, merged)
                    logger.warning("context_cas_merge", file=filename,
                                    expected=expected_hash, actual=current_hash)
                    return
            _atomic_write(path, _sanitize_data(content))
            logger.debug("context_updated", file=filename)

    async def append_context(self, filename: str, entry: str) -> None:
        """Append to a context file. Sanitizes for injection."""
        async with self._write_lock:
            path = self._safe_context_path(filename)
            existing = path.read_text() if path.exists() else ""
            _atomic_write(path, existing + _sanitize_data(entry) + "\n")

    def rotate_context_file(self, filename: str, max_lines: int = 200) -> None:
        """Rotate a context file if it exceeds max_lines.

        Keeps headers (lines starting with #) + the last max_lines content lines.
        Archives the removed content to context/archive/{filename}.{date}.md.
        """
        try:
            path = self._safe_context_path(filename)
        except ValueError:
            return
        if not path.exists():
            return

        lines = path.read_text().splitlines()
        if len(lines) <= max_lines:
            return

        headers = [l for l in lines if l.startswith("#")]
        content = [l for l in lines if not l.startswith("#")]

        if len(content) <= max_lines:
            return

        archived = content[:-max_lines]
        kept = headers + content[-max_lines:]

        # Archive
        archive_dir = self.context_dir / "archive"
        archive_dir.mkdir(exist_ok=True)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        archive_path = archive_dir / f"{filename}.{today}.md"
        _atomic_write(archive_path, "\n".join(archived) + "\n")

        # Write rotated file
        _atomic_write(path, "\n".join(kept) + "\n")

        logger.info(
            "context_file_rotated",
            file=filename,
            original_lines=len(lines),
            kept_lines=len(kept),
            archived_lines=len(archived),
        )

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
        """Append a durable fact to long-term memory.

        Prunes oldest entries if file exceeds 500 lines to prevent unbounded growth.
        The consolidation LLM should distill old entries before they're pruned.
        """
        fact = _sanitize_data(fact)
        async with self._write_lock:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            existing = self.memory_path.read_text() if self.memory_path.exists() else ""
            new_content = existing + f"- [{now}] {fact}\n"

            # Prune if > 500 lines (keep last 400 to avoid constant pruning)
            lines = new_content.splitlines(keepends=True)
            if len(lines) > 500:
                lines = lines[-400:]
                new_content = "".join(lines)
                logger.info("memory_pruned", kept=len(lines))

            _atomic_write(self.memory_path, new_content)

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
        """Use LLM to summarize a day's agent activity log."""
        from podclaw.llm_helper import quick_llm_call

        truncated = daily_content[:8000]

        return await quick_llm_call(
            system_prompt=(
                "You are PodClaw's memory consolidation system for a POD e-commerce store. "
                "Summarize the day's agent activities into concise bullet points. "
                "Focus on: key actions taken, patterns observed, metrics/numbers, "
                "follow-up items needed. Max 20 bullet points. Use '- ' prefix for each."
            ),
            user_prompt=f"Summarize this daily log for {date.strftime('%Y-%m-%d')}:\n\n{truncated}",
            model=CONSOLIDATION_MODEL,
            max_budget=0.03,
        )

    async def _llm_extract_learnings(self, weekly_content: str, current_memory: str) -> str:
        """Use LLM to extract durable facts from weekly log, avoiding duplicates."""
        from podclaw.llm_helper import quick_llm_call

        truncated_weekly = weekly_content[:8000]
        truncated_memory = current_memory[:4000]

        return await quick_llm_call(
            system_prompt=(
                "You are PodClaw's long-term memory extraction system. "
                "Extract durable facts and learnings from the weekly summary. "
                "Categorize each as: [Pattern], [Learning], [Opinion c=0-100], or [Fact]. "
                "Compare against existing MEMORY.md to avoid duplicates. "
                "Output only new/updated entries. Use '- ' prefix for each. "
                "Max 15 entries."
            ),
            user_prompt=(
                f"## Current MEMORY.md\n{truncated_memory}\n\n"
                f"## This Week's Summary\n{truncated_weekly}\n\n"
                "Extract new durable learnings:"
            ),
            model=CONSOLIDATION_MODEL,
            max_budget=0.03,
        )

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

        # Prune conversation transcripts > 30 days
        conversations_dir = self.memory_dir / "conversations"
        transcript_cutoff = now - timedelta(days=30)
        transcripts_pruned = 0
        if conversations_dir.is_dir():
            for f in conversations_dir.glob("*.jsonl"):
                try:
                    date_part = f.stem.split("-")[0:3]
                    file_date = datetime.strptime("-".join(date_part), "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    if file_date < transcript_cutoff:
                        f.unlink()
                        transcripts_pruned += 1
                except (ValueError, IndexError):
                    continue
        pruned["transcripts"] = transcripts_pruned

        if any(v for v in pruned.values()):
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

    def load_agent_context_summary(
        self, agent_name: str, context_files: list[str], include_memory: bool = True,
    ) -> str:
        """
        Build context string with SOUL.md + context file SUMMARIES.

        Args:
            include_memory: If True, include MEMORY.md (orchestrator context only).
                Sub-agents should pass False to respect memory privacy boundary.

        Instead of injecting 500+ lines of raw context files, generates 10-20 line
        mechanical summaries per file with key metrics and absolute paths for Read.
        The agent reads full files on demand when it needs detailed data.
        """
        parts = []

        soul = self.read_soul()
        if soul:
            parts.append(f"# Identity\n[DATA source=SOUL.md]\n{soul}\n[/DATA]")

        if include_memory:
            memory = self.read_memory()
            if memory:
                if len(memory) > _MEMORY_LOAD_MAX_BYTES:
                    memory = memory[-_MEMORY_LOAD_MAX_BYTES:]
                    nl = memory.find("\n")
                    if nl > 0:
                        memory = memory[nl + 1:]
                    memory = f"(truncated — showing last {_MEMORY_LOAD_MAX_BYTES} bytes)\n{memory}"
                parts.append(f"# Long-term Memory\n[DATA source=MEMORY.md]\n{memory}\n[/DATA]")

        if context_files:
            # Rotate oversized context files before summarizing
            for filename in context_files:
                limit = CONTEXT_FILE_MAX_LINES.get(filename)
                if limit:
                    self.rotate_context_file(filename, max_lines=limit)

            summary_lines = ["# Context File Summaries", ""]
            for filename in context_files:
                content = self.read_context(filename)
                if content:
                    try:
                        filepath = self._safe_context_path(filename)
                    except ValueError:
                        filepath = self.context_dir / filename
                    file_summary = self._summarize_file(filename, content, filepath)
                    summary_lines.append(file_summary)
                else:
                    try:
                        filepath = self._safe_context_path(filename)
                    except ValueError:
                        filepath = self.context_dir / filename
                    summary_lines.append(f"### {filename}\n- **Status**: Empty / not yet created\n- **Path**: `{filepath}`\n")

            parts.append("\n".join(summary_lines))

        return "\n\n---\n\n".join(parts)

    # -----------------------------------------------------------------------
    # Catalog (read-only EU product reference)
    # -----------------------------------------------------------------------

    def read_catalog(self, filename: str) -> str:
        """Read a catalog file. Read-only, no sanitization (admin-maintained)."""
        # Allow standard filenames plus catalog-specific names
        if not _CONTEXT_FILENAME_RE.match(filename) and filename not in (
            "PRICING-MODEL.md", "INDEX.md", "README.md",
        ):
            return ""
        path = (self.catalog_dir / filename).resolve()
        if not path.is_relative_to(self.catalog_dir.resolve()):
            return ""
        if path.exists():
            return path.read_text()
        return ""

    def load_catalog_summary(self, agent_name: str, catalog_files: list[str]) -> str:
        """Build catalog context string with INDEX + file paths for Read access.

        INDEX.md is injected in full (~80 lines compact summary).
        Other files are path-only references — the agent reads on demand.
        """
        if not catalog_files or not self.catalog_dir.exists():
            return ""

        catalog_root = self.catalog_dir.resolve()
        parts = ["# EU Product Catalog (READ-ONLY Reference)"]
        parts.append("> These files are READ-ONLY. Do not modify catalog files.")
        parts.append(f"> Catalog directory: `{catalog_root}`\n")

        # Always include INDEX.md content (compact summary)
        index = self.read_catalog("INDEX.md")
        if index:
            parts.append(f"[DATA source=catalog/INDEX.md]\n{index}\n[/DATA]")

        # For other files, provide path-only references (agent uses Read on demand)
        other_files = [f for f in catalog_files if f != "INDEX.md"]
        if other_files:
            parts.append("\n## Catalog File Paths (use Read for full data)")
            for fname in other_files:
                fpath = (self.catalog_dir / fname).resolve()
                parts.append(f"- `{fname}`: `{fpath}`")

        return "\n".join(parts)

    def _summarize_file(self, filename: str, content: str, filepath: Path) -> str:
        """Generate a 10-20 line mechanical summary of a context file."""
        lines = content.splitlines()
        line_count = len(lines)

        # Extract ## headers for structure overview
        headers = [l.strip() for l in lines if l.startswith("## ")][:8]

        # Build base summary
        parts = [f"### {filename} ({line_count} lines)"]
        parts.append(f"- **Full data**: `Read {filepath}`")

        # File-specific metric extraction
        if filename == "design_library.md":
            design_count = sum(1 for l in lines if l.startswith("|") and "approved" in l.lower())
            sourced = sum(1 for l in lines if "sourced" in l.lower() and l.startswith("|"))
            ai_gen = sum(1 for l in lines if ("fal" in l.lower() or "gemini" in l.lower()) and l.startswith("|"))
            parts.append(f"- **Designs**: ~{design_count} approved entries")
            if sourced + ai_gen > 0:
                parts.append(f"- **Sourcing ratio**: {sourced} sourced / {ai_gen} AI-generated")
            # Recent themes from last few entries
            recent = [l for l in lines[-20:] if l.startswith("|") and not l.startswith("|---")]
            if recent:
                parts.append(f"- **Recent entries**: {len(recent)} in last section")

        elif filename == "best_sellers.md":
            product_lines = [l for l in lines if l.startswith("|") and not l.startswith("|---") and not l.startswith("| Rank")]
            category_count = sum(1 for l in lines if l.startswith(("1.", "2.", "3.", "4.", "5.")))
            parts.append(f"- **Products listed**: ~{len(product_lines)} rows")
            parts.append(f"- **Trending categories**: ~{category_count} listed")
            # Check for seasonal section
            if any("seasonal" in l.lower() for l in lines):
                parts.append("- **Seasonal section**: present")

        elif filename == "pricing_history.md":
            open_alerts = sum(1 for l in lines if "OPEN" in l and l.startswith("|"))
            urgent_alerts = sum(1 for l in lines if "URGENT" in l and l.startswith("|"))
            benchmark_lines = sum(1 for l in lines if l.startswith("|") and "benchmark" not in l.lower() and ("€" in l or "EUR" in l))
            parts.append(f"- **Active alerts**: {open_alerts} OPEN, {urgent_alerts} URGENT")
            parts.append(f"- **Pricing entries**: ~{benchmark_lines} rows")
            if any("cost benchmark" in l.lower() for l in lines):
                parts.append("- **Cost Benchmarks section**: present")

        elif filename == "customer_insights.md":
            segment_lines = sum(1 for l in lines if "segment" in l.lower() or "RFM" in l)
            parts.append(f"- **Segment references**: ~{segment_lines}")

        elif filename == "qa_report.md":
            critical = sum(1 for l in lines if "CRITICAL" in l)
            warning = sum(1 for l in lines if "WARNING" in l)
            parts.append(f"- **Issues**: {critical} CRITICAL, {warning} WARNING")

        elif filename in ("design_workflow.md", "product_workflow.md"):
            parts.append("- **Type**: Reference procedure (read when needed)")

        else:
            # Generic: show section headers
            pass

        # Always show section headers
        if headers:
            parts.append("- **Sections**: " + " | ".join(h.replace("## ", "") for h in headers[:6]))

        # Archive visibility: show count of archived versions
        archive_dir = self.context_dir / "archive"
        if archive_dir.is_dir():
            archived = sorted(archive_dir.glob(f"{filename}.*"))
            if archived:
                first = archived[0].stem.rsplit(".", 1)[-1] if "." in archived[0].stem else "?"
                last = archived[-1].stem.rsplit(".", 1)[-1] if "." in archived[-1].stem else "?"
                parts.append(f"- **Archives**: {len(archived)} files ({first} to {last})")

        parts.append("")  # trailing newline
        return "\n".join(parts)

    def load_agent_context(
        self, agent_name: str, context_files: list[str], include_memory: bool = True,
    ) -> str:
        """
        Build context string for a sub-agent from SOUL.md + relevant context files.

        All data sections are wrapped in [DATA]...[/DATA] boundary markers to
        clearly separate trusted instructions from reference data.

        Args:
            include_memory: If True, include MEMORY.md (orchestrator context only).
                Sub-agents should pass False to respect memory privacy boundary.
        """
        parts = []

        soul = self.read_soul()
        if soul:
            parts.append(f"# Identity\n[DATA source=SOUL.md]\n{soul}\n[/DATA]")

        if include_memory:
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
