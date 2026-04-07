"""
PodClaw — Shared tool output parser for PostToolUse hooks.

Handles ALL formats the SDK may pass as tool_response:
1. str           — Raw JSON string
2. dict          — MCP content format {"content": [{"type": "text", "text": "<json>"}]}
                   OR a plain dict (already parsed)
3. list          — Content blocks without wrapper (SDK unwrapped)
                   OR direct list of dicts (e.g. Supabase array response)
4. JSON arrays   — '[{...}]' → extracts first dict element
"""

from __future__ import annotations

import json
from typing import Any


def _safe_json(text: str) -> Any:
    """Parse JSON safely, returning None on failure."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def parse_tool_output(raw: Any) -> dict | None:
    """Parse tool output into a dict, handling all SDK response formats.

    Returns the first dict found, or None if unparseable.
    """
    # --- Format: list (SDK content blocks OR direct list of dicts) ---
    if isinstance(raw, list):
        # Try content blocks first: [{"type": "text", "text": "<json>"}]
        for block in raw:
            if isinstance(block, dict) and block.get("type") == "text":
                parsed = _safe_json(block.get("text", ""))
                if isinstance(parsed, dict):
                    return parsed
                if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                    return parsed[0]
        # Direct list of dicts (e.g. Supabase array response)
        if raw and isinstance(raw[0], dict):
            return raw[0]
        return None

    # --- Format: str (raw JSON) ---
    if isinstance(raw, str):
        parsed = _safe_json(raw)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            return parsed[0]
        return None

    # --- Format: dict (MCP content wrapper OR plain dict) ---
    if isinstance(raw, dict):
        content = raw.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parsed = _safe_json(block.get("text", ""))
                    if isinstance(parsed, dict):
                        return parsed
                    if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                        return parsed[0]
            return None
        return raw

    return None
