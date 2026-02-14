"""
PodClaw — Client Factory
==========================

Creates Claude Agent SDK clients for each sub-agent with appropriate
model, tools, hooks, and system prompts.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

from podclaw.config import (
    AGENT_MODELS,
    AGENT_TOOLS,
    AGENT_CONTEXT_FILES,
    MAX_TURNS_PER_AGENT,
)
from podclaw.memory_manager import MemoryManager

logger = structlog.get_logger(__name__)


class ClientFactory:
    """Factory for creating per-agent Claude SDK clients."""

    def __init__(
        self,
        memory_manager: MemoryManager,
        mcp_connectors: dict[str, Any],
        hooks: dict[str, list],
        skills_dir: Path,
    ):
        self.memory = memory_manager
        self.connectors = mcp_connectors
        self.hooks = hooks
        self.skills_dir = skills_dir

    def _load_skill(self, agent_name: str) -> str:
        """Load SKILL.md for an agent."""
        skill_path = self.skills_dir / agent_name / "SKILL.md"
        if skill_path.exists():
            return skill_path.read_text()
        return ""

    def _build_tools(self, agent_name: str) -> list[dict[str, Any]]:
        """Build tool list for an agent from its MCP connectors."""
        tool_names = AGENT_TOOLS.get(agent_name, [])
        tools = []
        for name in tool_names:
            connector = self.connectors.get(name)
            if connector:
                for tool_name, tool_def in connector.get_tools().items():
                    tools.append({
                        "name": tool_name,
                        "description": tool_def.get("description", ""),
                        "input_schema": tool_def.get("input_schema", {}),
                    })
        return tools

    def _build_system_prompt(self, agent_name: str) -> str:
        """Build complete system prompt for a sub-agent."""
        context_files = AGENT_CONTEXT_FILES.get(agent_name, [])
        context = self.memory.load_agent_context(agent_name, context_files)
        skill = self._load_skill(agent_name)

        parts = []
        if skill:
            parts.append(skill)
        if context:
            parts.append(context)

        return "\n\n---\n\n".join(parts)

    def create_client(self, agent_name: str) -> ClaudeSDKClient:
        """
        Create a fully configured Claude SDK client for a sub-agent.

        Args:
            agent_name: One of the 8 sub-agent names

        Returns:
            Configured ClaudeSDKClient with registered tools
        """
        model = AGENT_MODELS.get(agent_name, "claude-sonnet-4-5-20250929")
        system_prompt = self._build_system_prompt(agent_name)
        tools = self._build_tools(agent_name)

        options = ClaudeAgentOptions(
            model=model,
            system_prompt=system_prompt,
            max_turns=MAX_TURNS_PER_AGENT,
            permission_mode="accept_edits",
            tools=tools,
        )

        client = ClaudeSDKClient(options)

        # Register hooks
        for hook in self.hooks.get("pre_tool_use", []):
            client.on_pre_tool_use(hook)
        for hook in self.hooks.get("post_tool_use", []):
            client.on_post_tool_use(hook)
        for hook in self.hooks.get("stop", []):
            client.on_stop(hook)

        logger.info(
            "client_created",
            agent=agent_name,
            model=model,
            tool_count=len(tools),
            tools=[t["name"] for t in tools],
        )

        return client
