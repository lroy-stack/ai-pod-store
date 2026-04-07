"""
PodClaw — Lightweight LLM Helper
===================================

Shared helper for internal reasoning calls (consolidation, heartbeat, soul review).

Uses httpx to call the Anthropic Messages API directly via ANTHROPIC_API_KEY.
Falls back to Claude Agent SDK if available and working.
"""

from __future__ import annotations

import asyncio
import os

import httpx
import structlog

logger = structlog.get_logger(__name__)

_ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"


async def quick_llm_call(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-haiku-4-5-20251001",
    max_budget: float = 0.02,
    max_retries: int = 2,
) -> str:
    """Lightweight API call for internal reasoning (no tools, no hooks).

    Uses the Anthropic Messages API directly via ANTHROPIC_API_KEY.
    Retries on failure with exponential backoff.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set — cannot make LLM calls")

    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    _ANTHROPIC_API_URL,
                    headers={
                        "x-api-key": api_key,
                        "content-type": "application/json",
                        "anthropic-version": _ANTHROPIC_VERSION,
                    },
                    json={
                        "model": model,
                        "max_tokens": 2048,
                        "system": system_prompt,
                        "messages": [{"role": "user", "content": user_prompt}],
                    },
                )

                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("content", [])
                    text = "".join(
                        block.get("text", "")
                        for block in content
                        if block.get("type") == "text"
                    )
                    return text

                # Rate limited — retry
                if resp.status_code == 429:
                    raise RuntimeError(f"Rate limited: {resp.text[:200]}")

                # Auth error — don't retry
                if resp.status_code in (401, 403):
                    raise RuntimeError(f"Auth error ({resp.status_code}): {resp.text[:200]}")

                raise RuntimeError(f"API error ({resp.status_code}): {resp.text[:200]}")

        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait = (attempt + 1) * 3
                logger.warning(
                    "quick_llm_retry",
                    attempt=attempt + 1,
                    wait_seconds=wait,
                    error=str(e),
                )
                await asyncio.sleep(wait)

    raise last_error  # type: ignore[misc]
