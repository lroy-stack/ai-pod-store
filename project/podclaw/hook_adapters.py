"""
PodClaw — Hook Adapters for Claude Agent SDK
================================================

Adapts PodClaw's existing hook functions to the SDK's native interfaces:

1. make_can_use_tool() — Converts PreToolUse deny hooks (security, cost_guard,
   rate_limit) into a single can_use_tool callback that returns
   PermissionResultAllow or PermissionResultDeny.

2. make_sdk_hooks() — Converts PostToolUse observation hooks (event_log, memory,
   metrics) and the PreToolUse observation hook (metrics_pre) into SDK
   HookMatcher entries.

Zero changes to existing hook implementations.
"""

from __future__ import annotations

from typing import Any

import structlog
from claude_agent_sdk import (
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# 1. can_use_tool — PreToolUse deny chain
# ---------------------------------------------------------------------------

def make_can_use_tool(
    pre_hooks: list,
    agent_name: str,
    session_id: str,
):
    """
    Create a can_use_tool callback from PodClaw PreToolUse deny hooks.

    The SDK calls this BEFORE executing any tool. If any hook returns
    permissionDecision="deny", the tool call is blocked.

    Args:
        pre_hooks: List of deny hooks [security_hook, cost_guard_hook, rate_limit_hook]
        agent_name: Sub-agent name (e.g. "finance")
        session_id: Current session UUID

    Returns:
        Async callable matching CanUseTool signature
    """

    async def can_use_tool(
        tool_name: str,
        tool_input: dict[str, Any],
        context: ToolPermissionContext,
    ) -> PermissionResultAllow | PermissionResultDeny:
        input_data = {
            "tool_name": tool_name,
            "tool_input": tool_input,
            "_agent_name": agent_name,
            "_session_id": session_id,
        }

        for hook in pre_hooks:
            try:
                result = await hook(input_data, tool_use_id=None, context=None)
                if not result:
                    continue
                hook_output = result.get("hookSpecificOutput", {})
                if hook_output.get("permissionDecision") == "deny":
                    reason = hook_output.get(
                        "permissionDecisionReason", "Denied by hook"
                    )
                    logger.warning(
                        "tool_denied",
                        hook=getattr(hook, "__name__", str(hook)),
                        tool=tool_name,
                        agent=agent_name,
                        reason=reason,
                    )
                    return PermissionResultDeny(message=reason)
            except Exception as e:
                # Fail-open: if a hook errors, allow the tool call
                logger.warning(
                    "deny_hook_error",
                    hook=getattr(hook, "__name__", str(hook)),
                    error=str(e),
                )

        return PermissionResultAllow()

    return can_use_tool


# ---------------------------------------------------------------------------
# 2. SDK hooks — PostToolUse observation + PreToolUse observation
# ---------------------------------------------------------------------------

def make_sdk_hooks(
    post_hooks: list,
    pre_observe_hooks: list,
    agent_name: str,
    session_id: str,
) -> dict:
    """
    Create SDK hook dict from PodClaw observation hooks.

    PostToolUse hooks (event_log, memory, metrics) run after each tool call
    for logging and metrics — they never block.

    PreToolUse observation hooks (metrics_pre) run before each tool call
    for timing — they never block either.

    Args:
        post_hooks: [event_log_hook, memory_hook, metrics_hook]
        pre_observe_hooks: [metrics_pre_hook]
        agent_name: Sub-agent name
        session_id: Current session UUID

    Returns:
        Dict suitable for ClaudeAgentOptions.hooks
    """

    async def post_tool_hook(hook_input, tool_use_id, context):
        input_data = {
            "tool_name": hook_input.get("tool_name", ""),
            "tool_input": hook_input.get("tool_input", {}),
            "tool_output": hook_input.get("tool_response"),
            "_agent_name": agent_name,
            "_session_id": session_id,
        }
        for hook in post_hooks:
            try:
                await hook(input_data, tool_use_id=tool_use_id, context=None)
            except Exception as e:
                logger.warning(
                    "post_hook_error",
                    hook=getattr(hook, "__name__", str(hook)),
                    error=str(e),
                )
        return {}

    hooks: dict = {
        "PostToolUse": [HookMatcher(matcher="*", hooks=[post_tool_hook])],
    }

    if pre_observe_hooks:
        async def pre_observe_hook(hook_input, tool_use_id, context):
            input_data = {
                "tool_name": hook_input.get("tool_name", ""),
                "tool_input": hook_input.get("tool_input", {}),
                "_agent_name": agent_name,
                "_session_id": session_id,
            }
            for hook in pre_observe_hooks:
                try:
                    await hook(input_data, tool_use_id=tool_use_id, context=None)
                except Exception as e:
                    logger.warning(
                        "pre_observe_hook_error",
                        hook=getattr(hook, "__name__", str(hook)),
                        error=str(e),
                    )
            return {}

        hooks["PreToolUse"] = [HookMatcher(matcher="*", hooks=[pre_observe_hook])]

    return hooks
