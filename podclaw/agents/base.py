"""
PodClaw — Base Agent Interface
================================

All 10 autonomous agents inherit from BaseAgent. Each agent defines:
- Its name, model, and schedule
- Which MCP tools it needs
- Which context files it reads
- Default task prompts per cycle
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base for PodClaw sub-agents.

    Each sub-agent is a configuration object — the actual Claude interaction
    is handled by the Orchestrator + ClientFactory.
    """

    name: str = ""
    model: str = ""
    schedule: str = ""
    tools: list[str] = []
    context_files: list[str] = []
    guardrails: dict[str, Any] = {}

    @abstractmethod
    def default_task(self) -> str:
        """Return the default task prompt for a scheduled cycle."""
        ...

    @abstractmethod
    def system_prompt_additions(self) -> str:
        """Return agent-specific system prompt additions beyond SKILL.md."""
        ...

    def describe(self) -> dict[str, Any]:
        """Return a serializable description of this agent."""
        return {
            "name": self.name,
            "model": self.model,
            "schedule": self.schedule,
            "tools": self.tools,
            "context_files": self.context_files,
            "guardrails": self.guardrails,
        }
