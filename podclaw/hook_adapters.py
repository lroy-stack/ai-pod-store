"""
PodClaw — Hook Adapters for Claude Agent SDK
================================================

Adapts PodClaw's existing hook functions to the SDK's native interfaces:

1. make_can_use_tool() — Converts PreToolUse deny hooks (security, cost_guard,
   rate_limit) into a single can_use_tool callback that returns
   PermissionResultAllow or PermissionResultDeny.

2. make_sdk_hooks() — Converts PostToolUse observation hooks + new SDK hooks
   (PreCompact, Stop, PostToolUseFailure) into HookMatcher entries.

Fail-closed for security_hook (index 0), fail-open for cost/rate hooks.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import structlog
from claude_agent_sdk import (
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

logger = structlog.get_logger(__name__)


def _short_name(tool_name: str) -> str:
    """Extract short tool name from MCP qualified name.

    The SDK passes MCP tools as 'mcp__{server}__{tool}' (e.g.
    'mcp__supabase__supabase_query'). Hooks compare against short
    names ('supabase_query'), so we strip the prefix here.
    """
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__", 2)
        if len(parts) == 3:
            return parts[2]
    return tool_name


# ---------------------------------------------------------------------------
# 1. can_use_tool — PreToolUse deny chain (fail-closed for security)
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

    Security model:
    - Hook index 0 (security_hook): FAIL-CLOSED — errors deny the tool call
    - Hook index 1+ (cost_guard, rate_limit): FAIL-OPEN — errors allow the tool call

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
        short = _short_name(tool_name)
        input_data = {
            "tool_name": short,
            "tool_input": tool_input,
            "_agent_name": agent_name,
            "_session_id": session_id,
        }

        for i, hook in enumerate(pre_hooks):
            try:
                result = await asyncio.wait_for(
                    hook(input_data, tool_use_id=None, context=None),
                    timeout=10.0,
                )
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
            except asyncio.TimeoutError:
                if i == 0:
                    # security_hook: FAIL-CLOSED — deny on timeout
                    logger.error(
                        "security_hook_timeout_denying",
                        tool=tool_name,
                        agent=agent_name,
                    )
                    return PermissionResultDeny(
                        message="Security hook timed out"
                    )
                else:
                    # cost_guard / rate_limit: FAIL-OPEN — allow on timeout
                    logger.warning(
                        "deny_hook_timeout",
                        hook=getattr(hook, "__name__", str(hook)),
                        tool=tool_name,
                    )
            except Exception as e:
                if i == 0:
                    # security_hook: FAIL-CLOSED — deny on error
                    logger.error(
                        "security_hook_error_denying",
                        tool=tool_name,
                        agent=agent_name,
                        error=str(e),
                    )
                    return PermissionResultDeny(
                        message=f"Security hook failed: {e}"
                    )
                else:
                    # cost_guard / rate_limit: FAIL-OPEN — allow on error
                    logger.warning(
                        "deny_hook_error",
                        hook=getattr(hook, "__name__", str(hook)),
                        error=str(e),
                    )

        return PermissionResultAllow()

    return can_use_tool


# ---------------------------------------------------------------------------
# 2. PreCompact hook — transcript archiving before SDK compaction
# ---------------------------------------------------------------------------

def make_precompact_hook(memory_manager, agent_name: str):
    """Flush observations to daily memory before SDK compacts context.

    The SDK calls PreCompact before it compresses the conversation. We seize
    this moment to save what the agent has seen so far — otherwise those
    observations are lost when context is compressed.

    Handles both formats:
    - transcript_path: file path to full transcript (jsonl)
    - messages: list of conversation messages (SDK native)
    """

    async def precompact_hook(input_data, tool_use_id, context):
        session_id = input_data.get("session_id", "unknown")

        # Strategy 1: transcript file exists — archive it
        transcript_path = input_data.get("transcript_path")
        if transcript_path and Path(transcript_path).exists():
            content = Path(transcript_path).read_text()
            await memory_manager.archive_transcript(session_id, content)
            logger.info("transcript_archived", session_id=session_id[:8])

        # Strategy 2: extract observations from messages and flush to daily log
        # Uses LLM summarization with mechanical fallback
        messages = input_data.get("messages", [])
        if messages:
            try:
                observations = await _llm_extract_observations(messages, agent_name)
            except Exception as e:
                logger.debug("llm_precompact_fallback", agent=agent_name, error=str(e))
                observations = _extract_observations(messages, agent_name)
            if observations:
                await memory_manager.append_daily(
                    agent_name,
                    f"[PreCompact flush — {session_id[:8]}]\n{observations}",
                )
                logger.info(
                    "precompact_flushed",
                    agent=agent_name,
                    session_id=session_id[:8],
                    observation_len=len(observations),
                )

        # Inject system message so agent knows compaction happened
        return {
            "systemMessage": (
                "[COMPACTION] Tu contexto fue comprimido para liberar espacio. "
                "Los archivos de contexto en /app/podclaw/memory/context/ "
                "y MEMORY.md contienen tu conocimiento persistente. "
                "Usa Read para re-orientarte si necesitas contexto previo. "
                "Continua desde donde estabas."
            ),
        }

    return precompact_hook


async def _llm_extract_observations(messages: list, agent_name: str) -> str:
    """Use LLM (Haiku) to extract key observations before context compaction.

    Cost: ~$0.002 per call. Falls through to _extract_observations() on failure.
    """
    from podclaw.llm_helper import quick_llm_call

    # Build a compact text representation of messages
    text_parts: list[str] = []
    tool_names: list[str] = []
    for msg in messages:
        content = msg.get("content", [])
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        if not isinstance(content, list):
            continue
        role = msg.get("role", "")
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text" and role == "assistant":
                text_parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_names.append(block.get("name", "unknown"))

    if not text_parts and not tool_names:
        return ""

    tools_summary = f"Tools used: {', '.join(tool_names[:20])}" if tool_names else ""
    assistant_text = "\n".join(text_parts)[-4000:]

    result = await quick_llm_call(
        system_prompt=(
            "Extract key observations from this AI agent conversation before context compaction. "
            "Focus on: decisions made, data found, errors encountered, patterns noticed, "
            "actions completed. Max 10 bullet points using '- ' prefix. Be concise."
        ),
        user_prompt=f"Agent: {agent_name}\n{tools_summary}\n\nAssistant output:\n{assistant_text}",
        model="claude-haiku-4-5-20251001",
        max_budget=0.005,
    )

    return result.strip()


def _extract_observations(messages: list, agent_name: str) -> str:
    """Mechanically extract key observations from conversation messages.

    No LLM call — this runs synchronously during PreCompact.
    Extracts: tool results summaries and assistant text snippets.
    """
    observations = []
    tool_count = 0

    for msg in messages:
        content = msg.get("content", [])
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        if not isinstance(content, list):
            continue

        role = msg.get("role", "")
        for block in content:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type", "")

            if block_type == "tool_use":
                tool_count += 1
            elif block_type == "text" and role == "assistant":
                text = block.get("text", "").strip()
                # Keep meaningful text (skip short acknowledgments)
                if len(text) > 80:
                    observations.append(f"- {text[:200]}")

    if tool_count > 0:
        observations.insert(0, f"- Used {tool_count} tools before compaction")

    return "\n".join(observations[:10])  # Cap at 10 observations


# ---------------------------------------------------------------------------
# 3. Stop hook — record agent stop events
# ---------------------------------------------------------------------------

def make_stop_hook(event_store, agent_name: str, session_id: str):
    """Log agent stop event to event store."""

    async def stop_hook(input_data, tool_use_id, context):
        await event_store.record(
            agent_name=agent_name,
            event_type="agent_stop",
            payload={
                "stop_hook_active": input_data.get("stop_hook_active", False),
            },
            session_id=session_id,
        )
        return {}

    return stop_hook


# ---------------------------------------------------------------------------
# 4. PostToolUseFailure hook — record tool failures
# ---------------------------------------------------------------------------

def make_failure_hook(event_store, agent_name: str, session_id: str):
    """Log tool failures to event store for observability."""

    async def failure_hook(input_data, tool_use_id, context):
        await event_store.record(
            agent_name=agent_name,
            event_type="tool_failure",
            payload={
                "tool": input_data.get("tool_name"),
                "error": input_data.get("error", "unknown"),
                "is_interrupt": input_data.get("is_interrupt", False),
            },
            session_id=session_id,
        )
        return {}

    return failure_hook


# ---------------------------------------------------------------------------
# 5. SDK hooks — full hook dict assembly
# ---------------------------------------------------------------------------

def make_sdk_hooks(
    post_hooks: list,
    pre_observe_hooks: list,
    agent_name: str,
    session_id: str,
    memory_manager=None,
    event_store=None,
) -> dict:
    """
    Create SDK hook dict from PodClaw observation hooks.

    Includes:
    - PostToolUse: event_log, memory, metrics (observation, never block)
    - PreToolUse: metrics_pre (observation, never block)
    - PreCompact: transcript archiving before SDK context compaction
    - Stop: record agent stop events
    - PostToolUseFailure: record tool failures for observability

    Args:
        post_hooks: [event_log_hook, memory_hook, metrics_hook]
        pre_observe_hooks: [metrics_pre_hook]
        agent_name: Sub-agent name
        session_id: Current session UUID
        memory_manager: MemoryManager for PreCompact hook
        event_store: EventStore for Stop/Failure hooks

    Returns:
        Dict suitable for ClaudeAgentOptions.hooks
    """

    async def post_tool_hook(hook_input, tool_use_id, context):
        tool_response = hook_input.get("tool_response")
        short = _short_name(hook_input.get("tool_name", ""))
        logger.debug(
            "post_hook_tool_response_type",
            type=type(tool_response).__name__,
            tool=short,
        )
        input_data = {
            "tool_name": short,
            "tool_input": hook_input.get("tool_input", {}),
            "tool_output": tool_response,
            "_agent_name": agent_name,
            "_session_id": session_id,
        }
        for hook in post_hooks:
            try:
                await asyncio.wait_for(
                    hook(input_data, tool_use_id=tool_use_id, context=None),
                    timeout=10.0,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "post_hook_timeout",
                    hook=getattr(hook, "__name__", str(hook)),
                    tool=short,
                )
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
                "tool_name": _short_name(hook_input.get("tool_name", "")),
                "tool_input": hook_input.get("tool_input", {}),
                "_agent_name": agent_name,
                "_session_id": session_id,
            }
            for hook in pre_observe_hooks:
                try:
                    await asyncio.wait_for(
                        hook(input_data, tool_use_id=tool_use_id, context=None),
                        timeout=10.0,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "pre_observe_hook_timeout",
                        hook=getattr(hook, "__name__", str(hook)),
                    )
                except Exception as e:
                    logger.warning(
                        "pre_observe_hook_error",
                        hook=getattr(hook, "__name__", str(hook)),
                        error=str(e),
                    )
            return {}

        hooks["PreToolUse"] = [HookMatcher(matcher="*", hooks=[pre_observe_hook])]

    # PreCompact: flush observations + archive transcript before SDK compaction
    if memory_manager is not None:
        precompact_hook = make_precompact_hook(memory_manager, agent_name)
        hooks["PreCompact"] = [HookMatcher(hooks=[precompact_hook])]

    # Stop: record agent stop events
    if event_store is not None:
        stop_hook = make_stop_hook(event_store, agent_name, session_id)
        hooks["Stop"] = [HookMatcher(hooks=[stop_hook])]

        # PostToolUseFailure: record tool failures
        failure_hook = make_failure_hook(event_store, agent_name, session_id)
        hooks["PostToolUseFailure"] = [HookMatcher(matcher="*", hooks=[failure_hook])]

    return hooks
