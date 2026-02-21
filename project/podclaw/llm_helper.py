"""
PodClaw — Lightweight LLM Helper
===================================

Shared helper for internal reasoning calls (consolidation, heartbeat, soul review).
Uses Claude Agent SDK (OAuth via `claude auth login`) — no ANTHROPIC_API_KEY needed.
"""

from __future__ import annotations

import asyncio

import structlog

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

logger = structlog.get_logger(__name__)


async def quick_llm_call(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-haiku-4-5-20251001",
    max_budget: float = 0.02,
    max_retries: int = 2,
) -> str:
    """Lightweight SDK call for internal reasoning (no tools, no hooks).

    Uses the SDK's OAuth authentication (plan Max) instead of ANTHROPIC_API_KEY.
    Retries on failure with exponential backoff.
    """
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            client = ClaudeSDKClient(ClaudeAgentOptions(
                model=model,
                system_prompt=system_prompt,
                max_turns=1,
                max_budget_usd=max_budget,
                permission_mode="acceptEdits",
                disallowed_tools=["Bash", "Edit", "Write", "Read", "Glob", "Grep",
                                  "WebSearch", "WebFetch"],
            ))

            await client.connect()
            try:
                await client.query(user_prompt)
                text = ""
                async for msg in client.receive_response():
                    if isinstance(msg, ResultMessage):
                        break
                    if hasattr(msg, "content"):
                        for block in msg.content:
                            if hasattr(block, "text"):
                                text += block.text
                return text
            finally:
                await client.disconnect()

        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait = (attempt + 1) * 5
                logger.warning(
                    "quick_llm_retry",
                    attempt=attempt + 1,
                    wait_seconds=wait,
                    error=str(e),
                )
                await asyncio.sleep(wait)

    raise last_error  # type: ignore[misc]
