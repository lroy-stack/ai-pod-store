"""
PodClaw — Connector → SDK MCP Server Adapter
===============================================

Converts any PodClaw MCP connector into an in-process McpSdkServerConfig
that the Claude Agent SDK can consume natively.

Each connector exposes get_tools() → {name: {description, input_schema, handler}}.
This module wraps those handlers into SdkMcpTool instances and creates a
single McpSdkServerConfig per connector via create_sdk_mcp_server().

Zero changes to existing connectors.
"""

from __future__ import annotations

import json
from typing import Any

from claude_agent_sdk import SdkMcpTool, create_sdk_mcp_server, McpSdkServerConfig


def connector_to_mcp_server(name: str, connector: Any) -> McpSdkServerConfig:
    """
    Convert a PodClaw MCP connector to an SDK MCP server config.

    Args:
        name: Connector name (e.g. "stripe", "supabase")
        connector: Any object with a get_tools() method returning
                   {tool_name: {description, input_schema, handler}}

    Returns:
        McpSdkServerConfig usable in ClaudeAgentOptions.mcp_servers
    """
    sdk_tools: list[SdkMcpTool] = []

    for tool_name, tool_def in connector.get_tools().items():
        handler = tool_def["handler"]

        # Use a factory function to capture the correct handler per iteration
        def _make_handler(h):
            async def wrapped(params: dict[str, Any]) -> dict[str, Any]:
                result = await h(params)
                return {
                    "content": [
                        {"type": "text", "text": json.dumps(result, default=str)}
                    ]
                }
            return wrapped

        sdk_tools.append(SdkMcpTool(
            name=tool_name,
            description=tool_def.get("description", ""),
            input_schema=tool_def.get("input_schema", {}),
            handler=_make_handler(handler),
        ))

    return create_sdk_mcp_server(name=name, tools=sdk_tools)
