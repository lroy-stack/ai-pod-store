"""
PodClaw — Client Factory
==========================

Creates Claude Agent SDK clients for each sub-agent with appropriate
model, MCP servers, hooks, system prompts, budgets, tool restrictions,
sandbox settings, and session persistence.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    McpSdkServerConfig,
    SandboxSettings,
)

from podclaw.config import (
    AGENT_BUDGETS,
    AGENT_ALLOWED_BUILTINS,
    AGENT_MODELS,
    AGENT_OUTPUT_SCHEMAS,
    AGENT_TOOLS,
    AGENT_CONTEXT_FILES,
    AGENT_CATALOG_FILES,
    MAX_TURNS_PER_AGENT,
    MODEL_COMPLEX,
    ORCHESTRATOR_ALL_CONNECTORS,
    ORCHESTRATOR_BUILTINS,
    ORCHESTRATOR_MAX_TURNS,
    ORCHESTRATOR_MODEL,
    ORCHESTRATOR_SESSION_BUDGET_USD,
)
from podclaw.connector_adapter import connector_to_mcp_server
from podclaw.hook_adapters import make_can_use_tool, make_sdk_hooks
from podclaw.memory_manager import MemoryManager
from podclaw.prompts import SECURITY_PREAMBLE

logger = structlog.get_logger(__name__)


class ClientFactory:
    """Factory for creating per-agent Claude SDK clients."""

    def __init__(
        self,
        memory_manager: MemoryManager,
        mcp_connectors: dict[str, Any],
        hooks: dict[str, list],
        skills_dir: Path,
        event_store: Any | None = None,
    ):
        self.memory = memory_manager
        self.connectors = mcp_connectors
        self.hooks = hooks
        self.skills_dir = skills_dir
        self.event_store = event_store

        # Pre-build MCP servers once (reusable across agents)
        self._mcp_servers: dict[str, McpSdkServerConfig] = {}
        for name, conn in self.connectors.items():
            try:
                self._mcp_servers[name] = connector_to_mcp_server(name, conn)
            except Exception as e:
                logger.warning("mcp_server_build_failed", connector=name, error=str(e))

    def _load_skill(self, agent_name: str) -> str:
        """Load SKILL.md for an agent."""
        skill_path = self.skills_dir / agent_name / "SKILL.md"
        if skill_path.exists():
            return skill_path.read_text()
        return ""

    def _build_mcp_servers(self, agent_name: str) -> dict[str, McpSdkServerConfig]:
        """Build MCP server dict for an agent from its connector mapping."""
        tool_names = AGENT_TOOLS.get(agent_name, [])
        return {
            name: self._mcp_servers[name]
            for name in tool_names
            if name in self._mcp_servers
        }

    def _build_allowed_tools(self, agent_name: str, mcp_servers: dict[str, McpSdkServerConfig]) -> list[str]:
        """Build complete list of allowed tools: builtins + MCP tools."""
        builtin_tools = AGENT_ALLOWED_BUILTINS.get(agent_name, ["Read", "Grep", "Glob"])

        # MCP tool names follow the pattern: mcp__{server_name}__{tool_name}
        # Build from connectors (which have get_tools()), not from McpSdkServerConfig (which is a dict)
        mcp_tool_names = []
        for server_name in mcp_servers:
            connector = self.connectors.get(server_name)
            if connector and hasattr(connector, "get_tools"):
                for tool_name in connector.get_tools():
                    mcp_tool_names.append(f"mcp__{server_name}__{tool_name}")

        return builtin_tools + mcp_tool_names

    # NOTE: _build_system_prompt() removed — prompt construction is handled by
    # core.py:build_sub_agent_prompt() which always passes system_prompt_override.
    # Single canonical prompt builder avoids logic drift between two builders.

    def create_client(
        self,
        agent_name: str,
        session_id: str = "",
        resume_sdk_session: str | None = None,
        system_prompt_override: str | None = None,
    ) -> ClaudeSDKClient:
        """
        Create a fully configured Claude SDK client for a sub-agent.

        Args:
            agent_name: One of the 10 agent names
            session_id: Current session UUID for hook context
            resume_sdk_session: SDK session ID to resume (for session persistence)
            system_prompt_override: If provided, replaces the default system prompt

        Returns:
            Configured ClaudeSDKClient with MCP servers, hooks, and permissions
        """
        model = AGENT_MODELS.get(agent_name, "claude-sonnet-4-5-20250929")
        if not system_prompt_override:
            raise ValueError(
                f"system_prompt_override is required for create_client(). "
                f"Use core.py:build_sub_agent_prompt() to construct the prompt."
            )
        system_prompt = system_prompt_override
        mcp_servers = self._build_mcp_servers(agent_name)

        # Deny hooks: security, cost_guard, rate_limit, production_governor (first 4 PreToolUse hooks)
        pre_hooks = self.hooks.get("pre_tool_use", [])
        deny_hooks = pre_hooks[:4]

        # Observation hooks: metrics_pre (5th PreToolUse hook, if present)
        observe_pre_hooks = pre_hooks[4:5]

        can_use_tool = make_can_use_tool(
            pre_hooks=deny_hooks,
            agent_name=agent_name,
            session_id=session_id,
        )

        sdk_hooks = make_sdk_hooks(
            post_hooks=self.hooks.get("post_tool_use", []),
            pre_observe_hooks=observe_pre_hooks,
            agent_name=agent_name,
            session_id=session_id,
            memory_manager=self.memory,
            event_store=self.event_store,
        )

        # Per-agent tool restrictions
        allowed_tools = self._build_allowed_tools(agent_name, mcp_servers)

        # Per-agent budget (SDK native enforcement)
        max_budget = AGENT_BUDGETS.get(agent_name, 0.50)

        # Output format for report-generating agents
        output_schema = AGENT_OUTPUT_SCHEMAS.get(agent_name)
        output_format = None
        if output_schema:
            output_format = {"type": "json_schema", "schema": output_schema}

        # Docker container IS the sandbox — no need for OS-level sandboxing
        # which can cause initialization timeouts in containerized environments

        options = ClaudeAgentOptions(
            model=model,
            system_prompt=system_prompt,
            max_turns=MAX_TURNS_PER_AGENT,
            max_budget_usd=max_budget,
            permission_mode="bypassPermissions",
            mcp_servers=mcp_servers,
            allowed_tools=allowed_tools,
            disallowed_tools=["Bash"],
            cwd=str(self.memory.workspace),
        )

        # Fallback model for Sonnet agents: degrade to Haiku on overload/errors
        if model == MODEL_COMPLEX:
            options.fallback_model = "claude-haiku-4-5-20251001"

        # Session persistence: resume previous conversation
        if resume_sdk_session:
            options.resume = resume_sdk_session

        # Structured output for report agents
        if output_format:
            options.output_format = output_format

        logger.info(
            "client_created",
            agent=agent_name,
            model=model,
            mcp_servers=list(mcp_servers.keys()),
            max_budget_usd=max_budget,
            allowed_tools_count=len(allowed_tools),
            resume=resume_sdk_session is not None,
        )

        return options

    def create_orchestrator(
        self,
        session_id: str = "",
        resume_sdk_session: str | None = None,
        system_prompt_override: str = "",
    ) -> ClaudeAgentOptions:
        """Create a fully configured SDK options for the CEO orchestrator.

        Unlike create_client() which filters tools per agent, the orchestrator
        gets ALL MCP servers (52 tools) + all builtins (Read, Write, Edit, Grep, Glob).
        The orchestrator THINKS and decides which tools to use — no routing table.
        """
        # ALL MCP servers (not filtered by agent)
        mcp_servers = {
            name: self._mcp_servers[name]
            for name in ORCHESTRATOR_ALL_CONNECTORS
            if name in self._mcp_servers
        }

        # ALL tools: builtins + every MCP tool
        mcp_tool_names = []
        for server_name in mcp_servers:
            connector = self.connectors.get(server_name)
            if connector and hasattr(connector, "get_tools"):
                for tool_name in connector.get_tools():
                    mcp_tool_names.append(f"mcp__{server_name}__{tool_name}")
        allowed_tools = list(ORCHESTRATOR_BUILTINS) + mcp_tool_names

        # Hook deny chain (same as sub-agents — security, cost, rate)
        pre_hooks = self.hooks.get("pre_tool_use", [])
        deny_hooks = pre_hooks[:4]
        can_use_tool = make_can_use_tool(
            pre_hooks=deny_hooks,
            agent_name="orchestrator",
            session_id=session_id,
        )

        options = ClaudeAgentOptions(
            model=ORCHESTRATOR_MODEL,
            system_prompt=system_prompt_override,
            max_turns=ORCHESTRATOR_MAX_TURNS,
            max_budget_usd=ORCHESTRATOR_SESSION_BUDGET_USD,
            permission_mode="bypassPermissions",
            mcp_servers=mcp_servers,
            allowed_tools=allowed_tools,
            disallowed_tools=["Bash"],
            cwd=str(self.memory.workspace),
        )

        if resume_sdk_session:
            options.resume = resume_sdk_session

        logger.info(
            "orchestrator_created",
            model=ORCHESTRATOR_MODEL,
            mcp_servers=list(mcp_servers.keys()),
            max_budget_usd=ORCHESTRATOR_SESSION_BUDGET_USD,
            allowed_tools_count=len(allowed_tools),
            resume=resume_sdk_session is not None,
        )

        return options
