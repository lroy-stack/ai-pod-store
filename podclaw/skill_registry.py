# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Skill Registry
==========================

Discovers skills on disk, generates compact manifests for orchestrator prompt,
loads full skill content on-demand for sub-agent sessions.

Skill structure:
  skills/{agent}/ROLE.md                      → role skill (always loaded)
  skills/{agent}/tasks/{skill_name}/SKILL.md  → task skill (loaded on-demand)
  skills/{agent}/tasks/{skill_name}/*.md      → reference skills (loaded with task)

Frontmatter in SKILL.md:
  <!-- triggers: dtg, t-shirt, camiseta -->
  <!-- description: Pipeline for DTG garment design -->
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import structlog

from podclaw.config import BRAND_NAME

logger = structlog.get_logger(__name__)

_SKILL_VARS = {
    "YOUR_BRAND_NAME": BRAND_NAME,
}


def _substitute_skill_vars(content: str) -> str:
    """Replace static placeholders in skill files with runtime env values."""
    for placeholder, value in _SKILL_VARS.items():
        content = content.replace(placeholder, value)
    return content


@dataclass
class SkillManifest:
    """Compact metadata for orchestrator system prompt."""
    agent: str
    skill_name: str
    skill_type: str  # "role" | "task" | "reference"
    triggers: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class SkillContent:
    """Full skill content for sub-agent injection."""
    role_md: str = ""
    task_md: str = ""
    references: list[str] = field(default_factory=list)


_TRIGGER_RE = re.compile(r"<!--\s*triggers:\s*(.+?)\s*-->", re.IGNORECASE)
_DESC_RE = re.compile(r"<!--\s*description:\s*(.+?)\s*-->", re.IGNORECASE)
_HEADING_RE = re.compile(r"^#\s+(.+)", re.MULTILINE)
_YAML_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


class SkillRegistry:
    """Discovers and loads skills from podclaw/skills/ directory."""

    def __init__(self, skills_dir: Path):
        self.skills_dir = skills_dir
        self._manifests: list[SkillManifest] = []
        self._scan()

    def _scan(self) -> None:
        """Walk skills_dir, index all ROLE.md and tasks/*/SKILL.md."""
        self._manifests.clear()

        if not self.skills_dir.is_dir():
            logger.warning("skills_dir_not_found", path=str(self.skills_dir))
            return

        for agent_dir in sorted(self.skills_dir.iterdir()):
            if not agent_dir.is_dir() or agent_dir.name.startswith("."):
                continue

            agent_name = agent_dir.name

            # Index ROLE.md
            role_path = agent_dir / "ROLE.md"
            if role_path.is_file():
                self._manifests.append(SkillManifest(
                    agent=agent_name,
                    skill_name="role",
                    skill_type="role",
                    description=self._extract_description(role_path),
                ))

            # Index tasks/*/SKILL.md
            tasks_dir = agent_dir / "tasks"
            if not tasks_dir.is_dir():
                continue

            for task_dir in sorted(tasks_dir.iterdir()):
                if not task_dir.is_dir() or task_dir.name.startswith("."):
                    continue

                skill_path = task_dir / "SKILL.md"
                if not skill_path.is_file():
                    continue

                content = skill_path.read_text(errors="replace")
                triggers = self._extract_triggers(content)
                description = self._extract_description_from_content(content)

                self._manifests.append(SkillManifest(
                    agent=agent_name,
                    skill_name=task_dir.name,
                    skill_type="task",
                    triggers=triggers,
                    description=description,
                ))

        logger.info(
            "skills_scanned",
            total=len(self._manifests),
            roles=sum(1 for m in self._manifests if m.skill_type == "role"),
            tasks=sum(1 for m in self._manifests if m.skill_type == "task"),
        )

    def get_manifest_table(self) -> str:
        """Return compact markdown table for orchestrator prompt (~300 tokens)."""
        task_manifests = [m for m in self._manifests if m.skill_type == "task"]
        if not task_manifests:
            return "## Available Skills\n\nNo task skills discovered."

        lines = [
            "## Available Skills",
            "",
            "| Agent | Skill | Triggers | Description |",
            "|-------|-------|----------|-------------|",
        ]
        for m in task_manifests:
            triggers_str = ", ".join(m.triggers[:5]) if m.triggers else "-"
            desc = m.description[:60] if m.description else "-"
            lines.append(f"| {m.agent} | {m.skill_name} | {triggers_str} | {desc} |")

        return "\n".join(lines)

    def get_skills_xml(self) -> str:
        """Return XML-formatted skills list for orchestrator prompt.

        XML tags create structural boundaries that the model respects more
        than markdown tables. Based on OpenClaw system-prompt.ts pattern.
        Only includes skills with triggers (operational skills, not product-specific).
        """
        task_manifests = [
            m for m in self._manifests
            if m.skill_type == "task" and m.triggers
        ]
        if not task_manifests:
            return ""

        lines = ["<available_skills>"]
        for m in task_manifests:
            path = f"/app/podclaw/skills/{m.agent}/tasks/{m.skill_name}/SKILL.md"
            triggers = ", ".join(m.triggers[:8])
            desc = m.description[:80] if m.description else m.skill_name
            lines.append(
                f'<skill name="{m.skill_name}" '
                f'path="{path}" '
                f'triggers="{triggers}" '
                f'description="{desc}" />'
            )
        lines.append("</available_skills>")
        return "\n".join(lines)

    def load_role(self, agent_name: str) -> str:
        """Load ROLE.md for an agent. Returns empty string if not found."""
        role_path = self.skills_dir / agent_name / "ROLE.md"
        if role_path.is_file():
            return _substitute_skill_vars(role_path.read_text(errors="replace"))
        return ""

    def load_task_skill(self, agent_name: str, skill_name: str) -> SkillContent:
        """Load full skill content (ROLE + task + references) for sub-agent injection."""
        content = SkillContent()

        # Load ROLE.md
        content.role_md = self.load_role(agent_name)

        # Load task SKILL.md
        task_dir = self.skills_dir / agent_name / "tasks" / skill_name
        skill_path = task_dir / "SKILL.md"
        if skill_path.is_file():
            content.task_md = _substitute_skill_vars(skill_path.read_text(errors="replace"))

        # Load reference files (sibling .md files, not SKILL.md)
        if task_dir.is_dir():
            for ref_path in sorted(task_dir.glob("*.md")):
                if ref_path.name != "SKILL.md":
                    content.references.append(_substitute_skill_vars(ref_path.read_text(errors="replace")))

        return content

    def find_skill_for_task(self, agent_name: str, task_description: str) -> str | None:
        """Match task description to a skill name via keyword matching.

        Returns the skill_name of the best match, or None.
        Simple keyword match against triggers — no LLM call.
        """
        if not task_description:
            return None

        task_lower = task_description.lower()
        best_match: str | None = None
        best_score = 0

        for manifest in self._manifests:
            if manifest.agent != agent_name or manifest.skill_type != "task":
                continue

            score = 0
            for trigger in manifest.triggers:
                if trigger.lower() in task_lower:
                    score += 1

            # Also match skill name fragments
            if manifest.skill_name.replace("-", " ") in task_lower:
                score += 2
            elif manifest.skill_name.replace("-", "") in task_lower.replace(" ", ""):
                score += 1

            if score > best_score:
                best_score = score
                best_match = manifest.skill_name

        return best_match

    def find_skills_for_pipeline_step(
        self,
        agent_name: str,
        task_description: str,
        pipeline_context: str = "",
    ) -> list[tuple[str, int]]:
        """Find skills matching a pipeline step, returning ranked (skill_name, score) pairs.

        Extends find_skill_for_task() to also consider pipeline context keywords
        and returns multiple matches sorted by score (highest first).
        """
        if not task_description:
            return []

        combined = f"{task_description} {pipeline_context}".lower()
        scored: list[tuple[str, int]] = []

        for manifest in self._manifests:
            if manifest.agent != agent_name or manifest.skill_type != "task":
                continue

            score = 0
            for trigger in manifest.triggers:
                if trigger.lower() in combined:
                    score += 1

            if manifest.skill_name.replace("-", " ") in combined:
                score += 2
            elif manifest.skill_name.replace("-", "") in combined.replace(" ", ""):
                score += 1

            if score > 0:
                scored.append((manifest.skill_name, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    def validate(self) -> list[str]:
        """Check skill directory integrity. Returns list of warnings."""
        warnings: list[str] = []

        for agent_dir in sorted(self.skills_dir.iterdir()):
            if not agent_dir.is_dir() or agent_dir.name.startswith("."):
                continue

            agent = agent_dir.name
            has_role = (agent_dir / "ROLE.md").is_file()
            tasks_dir = agent_dir / "tasks"

            if has_role and not tasks_dir.is_dir():
                warnings.append(f"{agent}: has ROLE.md but no tasks/ directory")

            if not tasks_dir.is_dir():
                continue

            for task_dir in sorted(tasks_dir.iterdir()):
                if not task_dir.is_dir() or task_dir.name.startswith("."):
                    continue

                skill_path = task_dir / "SKILL.md"
                if not skill_path.is_file():
                    warnings.append(f"{agent}/tasks/{task_dir.name}: missing SKILL.md")
                    continue

                content = skill_path.read_text(errors="replace")
                if not _TRIGGER_RE.search(content[:500]):
                    warnings.append(
                        f"{agent}/tasks/{task_dir.name}: SKILL.md missing <!-- triggers: ... -->"
                    )

        return warnings

    def rescan(self) -> None:
        """Re-scan skills directory. Called when skills are added at runtime."""
        self._scan()

    def list_skills(self, agent_name: str) -> list[SkillManifest]:
        """List all skills for an agent."""
        return [m for m in self._manifests if m.agent == agent_name]

    def list_all_agents(self) -> list[str]:
        """List all agent names that have skills."""
        return sorted(set(m.agent for m in self._manifests))

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _extract_triggers(content: str) -> list[str]:
        """Extract triggers from SKILL.md frontmatter (HTML comments or YAML)."""
        # Try HTML comment format: <!-- triggers: a, b, c -->
        match = _TRIGGER_RE.search(content[:500])
        if match:
            return [t.strip() for t in match.group(1).split(",") if t.strip()]

        # Try YAML frontmatter format: ---\ntriggers: a, b, c\n---
        yaml_match = _YAML_FRONTMATTER_RE.match(content)
        if yaml_match:
            frontmatter = yaml_match.group(1)
            for line in frontmatter.splitlines():
                line = line.strip()
                if line.lower().startswith("triggers:"):
                    value = line.split(":", 1)[1].strip()
                    # Handle both "a, b, c" and "- a\n- b\n- c" formats
                    if value:
                        return [t.strip().lstrip("- ") for t in value.split(",") if t.strip()]

        return []

    @staticmethod
    def _extract_description_from_content(content: str) -> str:
        """Extract description from frontmatter (HTML or YAML) or first heading."""
        # Try HTML comment first
        match = _DESC_RE.search(content[:500])
        if match:
            return match.group(1).strip()

        # Try YAML frontmatter
        yaml_match = _YAML_FRONTMATTER_RE.match(content)
        if yaml_match:
            frontmatter = yaml_match.group(1)
            lines = frontmatter.splitlines()
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.lower().startswith("description:"):
                    value = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                    # Handle YAML multiline (>- or |)
                    if value in (">-", ">", "|", "|-"):
                        # Collect indented continuation lines
                        desc_parts = []
                        for j in range(i + 1, len(lines)):
                            next_line = lines[j]
                            if next_line and (next_line[0] == " " or next_line[0] == "\t"):
                                desc_parts.append(next_line.strip())
                            else:
                                break
                        return " ".join(desc_parts) if desc_parts else ""
                    if value:
                        return value

        # Fallback: first heading
        match = _HEADING_RE.search(content[:300])
        if match:
            heading = match.group(1).strip()
            for suffix in [" — SKILL.md", " — Skill Definition", " SKILL"]:
                heading = heading.removesuffix(suffix)
            return heading

        return ""

    def _extract_description(self, path: Path) -> str:
        """Extract description from a file."""
        try:
            content = path.read_text(errors="replace")
            return self._extract_description_from_content(content)
        except OSError:
            return ""
