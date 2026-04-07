# Copyright (c) 2026 L.LOWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Orchestrator Prompt Builder
========================================

Deterministic context loading and system prompt composition.
Two prompts:
  - build_system_prompt(): for sub-agent sessions (identity + memory + capabilities)
  - build_orchestrator_prompt(): for CEO conversation (security → skills → boundaries → ...)
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from podclaw.config import (
    AGENT_MODELS,
    AGENT_NAMES,
    DAILY_LOG_TAIL_LINES,
    IDENTITY_FILES,
    ORCHESTRATOR_DAILY_BUDGET_EUR,
    ORCHESTRATOR_MODEL,
)
from podclaw.memory_manager import MemoryManager
from podclaw.prompts import SECURITY_PREAMBLE
from podclaw.skill_registry import SkillRegistry

logger = structlog.get_logger(__name__)


class OrchestratorStartup:
    """Deterministic context loading for orchestrator sessions.

    Implements MEMORY_IDENTITY_DEFINITION.md Section 3.4.
    Composes the orchestrator system prompt from identity, memory, and capabilities.
    """

    def __init__(
        self,
        memory: MemoryManager,
        skill_registry: SkillRegistry,
        workspace: Path,
    ):
        self.memory = memory
        self.skills = skill_registry
        self.workspace = workspace

    async def build_system_prompt(self) -> str:
        """Build the orchestrator's system prompt from identity + memory + capabilities.

        Loading order matters:
        1. Identity first — the model needs to know WHO it is
        2. Current state — what needs attention RIGHT NOW
        3. Long-term context — historical patterns and wisdom
        4. Capabilities — what tools and agents are available
        5. System state — time, budget, health
        """
        parts: list[str] = []

        # Phase 1: Identity (who am I?)
        soul = self._read_file(IDENTITY_FILES["soul"])
        if soul:
            parts.append(soul)

        ceo = self._read_file(IDENTITY_FILES["ceo"])
        if ceo:
            parts.append(ceo)

        # Phase 2: Current state (what's happening?)
        heartbeat = self._read_file(IDENTITY_FILES["heartbeat"])
        if heartbeat:
            parts.append(heartbeat)

        daily_log = self._read_daily_log_tail(DAILY_LOG_TAIL_LINES)
        if daily_log:
            parts.append(daily_log)

        # Phase 3: Long-term context (what do I know?)
        memory_md = self._read_file(IDENTITY_FILES["memory"])
        if memory_md:
            parts.append(memory_md)

        # Phase 4: Capabilities (what can I do?)
        parts.append(self._build_agent_manifest())
        parts.append(self._build_pipeline_manifest())
        skill_table = self.skills.get_manifest_table()
        if skill_table:
            parts.append(skill_table)

        # Phase 5: System state
        parts.append(await self._build_system_context())

        return "\n\n---\n\n".join(parts)

    def _read_file(self, relative_path: str) -> str:
        """Read a file relative to workspace. Returns empty string on failure."""
        try:
            path = self.workspace / relative_path
            if path.is_file():
                return path.read_text(errors="replace").strip()
        except OSError:
            pass
        return ""

    def _read_daily_log_tail(self, lines: int) -> str:
        """Read the tail of today's daily log."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        log_path = self.workspace / f"podclaw/memory/{today}.md"
        try:
            if log_path.is_file():
                content = log_path.read_text(errors="replace")
                all_lines = content.splitlines()
                tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
                return f"## Today's Activity Log (last {len(tail)} lines)\n\n" + "\n".join(tail)
        except OSError:
            pass
        return ""

    def _build_agent_manifest(self) -> str:
        """Table: agent | model | status | daily budget."""
        lines = [
            "## Agent Manifest",
            "",
            "| Agent | Model | Daily Budget (EUR) |",
            "|-------|-------|--------------------|",
        ]
        for name in AGENT_NAMES:
            from podclaw.config import AGENT_DAILY_BUDGETS
            model = AGENT_MODELS.get(name, "unknown")
            model_short = "Haiku" if "haiku" in model else "Sonnet"
            budget = AGENT_DAILY_BUDGETS.get(name, 0)
            lines.append(f"| {name} | {model_short} | {budget:.2f} |")
        return "\n".join(lines)

    def _build_pipeline_manifest(self) -> str:
        """Table: pipeline | trigger | steps summary."""
        from podclaw.pipeline_engine import PIPELINE_REGISTRY

        if not PIPELINE_REGISTRY:
            return "## Pipeline Templates\n\nNo pipelines registered."

        lines = [
            "## Pipeline Templates",
            "",
            "| Pipeline | Description | Steps |",
            "|----------|-------------|-------|",
        ]
        for pipeline in PIPELINE_REGISTRY.values():
            step_chain = " → ".join(
                f"{s.agent}({s.name})" for s in pipeline.steps
            )
            lines.append(f"| {pipeline.name} | {pipeline.description[:60]} | {step_chain} |")

        return "\n".join(lines)

    async def _build_system_context(self) -> str:
        """Current date/time, budget info, dynamic state."""
        now = datetime.now(timezone.utc)
        total_budget = ORCHESTRATOR_DAILY_BUDGET_EUR + 23.50
        lines = [
            "## System Context\n",
            f"- **Current time (UTC)**: {now.strftime('%Y-%m-%d %H:%M')}",
            f"- **Orchestrator model**: {ORCHESTRATOR_MODEL}",
            f"- **Daily budget cap**: EUR {total_budget:.2f} (orchestrator {ORCHESTRATOR_DAILY_BUDGET_EUR:.2f} + agents 23.50)",
        ]

        try:
            from podclaw.hooks.cost_guard_hook import get_daily_spent
            spent = await get_daily_spent()
            remaining = total_budget - spent
            lines.append(f"- **Budget spent today**: EUR {spent:.2f} (remaining: EUR {remaining:.2f})")
        except Exception:
            pass

        import os as _os
        _domain = _os.environ.get("STORE_DOMAIN", "localhost")
        _currency = _os.environ.get("STORE_CURRENCY", "EUR")
        lines.extend([
            f"- **Domain**: {_domain}",
            "- **Provider**: Printful (EU fulfillment only)",
            f"- **Currency**: {_currency}",
        ])
        return "\n".join(lines)

    async def build_orchestrator_prompt(self) -> str:
        """Build the conversational orchestrator system prompt.

        Section order optimized for instruction adherence (OpenClaw + SDK best practices):
        Security → Skills → Boundaries → Memory → Identity → User → Context → Response

        Skills in position 2 (high positional weight) with XML format
        and imperative language for deterministic skill selection.
        """
        parts: list[str] = []

        # [1] Security preamble (immutable, first position — never moves)
        parts.append(SECURITY_PREAMBLE)

        # [2] Skills (MANDATORY — position 2 for maximum adherence)
        skills_xml = self.skills.get_skills_xml()
        if skills_xml:
            parts.append(
                "## Skills (MANDATORY — read before replying)\n\n"
                "You MUST scan the skills below before responding.\n"
                "If exactly one matches the CEO's request: use Read to load its SKILL.md "
                "at the path shown, then follow its instructions step by step.\n"
                "If none matches: respond directly using your tools.\n"
                "Never read more than one skill. Never use Grep or Glob to explore.\n\n"
                f"{skills_xml}"
            )

        # [3] Boundaries (what you CANNOT do — before identity so it has weight)
        parts.append(
            "## Boundaries\n\n"
            "- You have NO access to infrastructure (VPS, Docker, DNS, servers)\n"
            "- You CANNOT restart services, modify configs, or access terminals\n"
            "- If a tool fails, try a simpler query — do NOT suggest infrastructure fixes\n"
            "- Never use Grep, Glob, or WebFetch unless a skill explicitly says to\n"
            "- Send emails ONE AT A TIME, never in parallel\n"
            "- If blocked, tell the CEO what happened and ask for guidance"
        )

        # [4] Memory (how to get data — before identity so agent queries first)
        parts.append(
            "## Data Access\n\n"
            "For store data (products, orders, subscribers, coupons): use supabase_query.\n"
            "For context files: use Read with paths in /app/podclaw/memory/context/.\n"
            "For long-term knowledge: Read /app/podclaw/memory/MEMORY.md.\n"
            "Do NOT guess data. Do NOT hardcode values. Always query."
        )

        # [5] Identity (SOUL.md — who you are)
        soul = self._read_file(IDENTITY_FILES["soul"])
        if soul:
            parts.append(f"## Identity\n\n{soul}")

        # [6] User (CEO.md — who you serve, learn dynamically)
        ceo = self._read_file(IDENTITY_FILES["ceo"])
        if ceo:
            parts.append(
                f"## User\n\n{ceo}\n\n"
                "_If you observe a CEO preference not yet in CEO.md "
                "(language, timezone, communication style, design taste, "
                "priorities), use Write to update /app/podclaw/CEO.md "
                "with the observation. Keep it factual, not a dossier._"
            )

        # [7] Pending tasks (HEARTBEAT.md)
        heartbeat = self._read_file(IDENTITY_FILES["heartbeat"])
        if heartbeat:
            parts.append(f"## Pending Tasks\n\n{heartbeat}")

        # [8] Long-term memory (MEMORY.md — curated wisdom, max 4KB)
        memory_md = self._read_file(IDENTITY_FILES["memory"])
        if memory_md:
            if len(memory_md) > 4096:
                memory_md = memory_md[-4096:]
                nl = memory_md.find("\n")
                if nl > 0:
                    memory_md = memory_md[nl + 1:]
            parts.append(f"## Long-term Memory\n\n{memory_md}")

        # [9] Today's activity (daily log tail — what you did today)
        daily_log = self._read_daily_log_tail(30)
        if daily_log:
            parts.append(daily_log)

        # [10] Context (date, budget, currency)
        parts.append(await self._build_system_context())

        # [8] Response format
        parts.append(
            "## Response\n\n"
            "- Match the CEO's language\n"
            "- Brief: 2-3 sentences unless more detail requested\n"
            "- Data-backed: cite numbers, not opinions\n"
            "- If delegating complex work: explain what you'll do first"
        )

        return "\n\n---\n\n".join(parts)
