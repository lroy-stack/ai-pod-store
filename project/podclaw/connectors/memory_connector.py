"""
Memory MCP Connector — exposes memory tools to PodClaw.
================================================================

Wraps the local MemoryStore (SQLite + hybrid search) as MCP tools:
- memory_search: semantic recall of past information
- memory_stats: cognitive memory telemetry (read-only)
- memory_health_check: cognitive health evaluation (diagnostic)
- memory_policy_current: read effective memory policy (defaults + overrides)
- memory_policy_update: adjust memory thresholds at runtime (admin only)
"""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Validation ranges for memory policy overrides (safe bounds)
_POLICY_RANGES: dict[str, tuple[float, float]] = {
    "importance_threshold": (0.5, 0.9),
    "decay_days": (7, 365),
    "decay_amount": (0.01, 0.3),
    "prune_threshold": (0.1, 0.5),
    "access_boost": (0.0, 0.1),
    "max_chunks": (100, 10000),
}


class MemoryMCPConnector:
    """MCP connector exposing memory tools over local memory store."""

    def __init__(self, store: Any, state_store: Any | None = None):
        self._store = store
        self._state_store = state_store

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "memory_search": {
                "description": (
                    "Semantic search over PodClaw's long-term memory. "
                    "Searches SOUL.md, MEMORY.md, daily logs, and context files "
                    "stored locally. Use when you need to recall past information, "
                    "preferences, patterns, or decisions that aren't in the "
                    "immediate conversation context. Returns up to 5 relevant "
                    "memory chunks ranked by relevance."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Natural language search query describing what you want to recall",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (1-5, default 5)",
                            "default": 5,
                        },
                    },
                    "required": ["query"],
                },
                "handler": self._search,
            },
            "memory_stats": {
                "description": (
                    "Cognitive memory telemetry — read-only snapshot of PodClaw's "
                    "durable memory state. Returns: total chunks, distribution by "
                    "memory type and importance range, top accessed memories, "
                    "averages, and growth trends. Use to monitor memory health "
                    "and understand what PodClaw remembers."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "include_growth": {
                            "type": "boolean",
                            "description": "Include daily growth data for last 30 days (default false)",
                            "default": False,
                        },
                    },
                },
                "handler": self._stats,
            },
            "memory_health_check": {
                "description": (
                    "Cognitive health evaluation — deterministic diagnostic of "
                    "PodClaw's memory system. Returns status (healthy/warning/critical), "
                    "active flags (overload, stagnation, low_signal, unused_memory_ratio, "
                    "growth_rate_anomaly), and recommended action. Read-only, no mutations. "
                    "Use when the admin asks about memory health or system diagnostics."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {},
                },
                "handler": self._health_check,
            },
            "memory_policy_current": {
                "description": (
                    "Read the effective memory policy — returns current thresholds "
                    "controlling how PodClaw's cognitive memory behaves. Shows both "
                    "default values (from config) and any admin overrides. Fields: "
                    "importance_threshold, decay_days, decay_amount, prune_threshold, "
                    "access_boost, max_chunks. Read-only, no side effects."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {},
                },
                "handler": self._policy_current,
            },
            "memory_policy_update": {
                "description": (
                    "Adjust PodClaw's memory policy thresholds at runtime. "
                    "Changes take effect immediately — no restart needed. "
                    "Only affects future behavior, not existing memories. "
                    "All parameters are optional — only pass the ones you want to change. "
                    "Safe ranges are enforced. Use memory_policy_current first to see "
                    "current values before adjusting."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "importance_threshold": {
                            "type": "number",
                            "description": "Minimum importance to persist a memory (0.5-0.9, default 0.65). Higher = stricter filtering.",
                        },
                        "decay_days": {
                            "type": "integer",
                            "description": "Days before unused memories start decaying (7-365, default 30).",
                        },
                        "decay_amount": {
                            "type": "number",
                            "description": "Importance reduction per decay cycle (0.01-0.3, default 0.1).",
                        },
                        "prune_threshold": {
                            "type": "number",
                            "description": "Importance below which memories are pruning candidates (0.1-0.5, default 0.3).",
                        },
                        "access_boost": {
                            "type": "number",
                            "description": "Importance boost per memory access/recall (0.0-0.1, default 0.02).",
                        },
                        "max_chunks": {
                            "type": "integer",
                            "description": "Max conversation memory chunks before pruning triggers (100-10000, default 1000).",
                        },
                    },
                },
                "handler": self._policy_update,
            },
        }

    async def _search(self, params: dict[str, Any]) -> dict[str, Any]:
        query = params.get("query", "")
        if not query.strip():
            return {"results": [], "count": 0, "error": "Empty query"}
        limit = min(max(params.get("limit", 5), 1), 5)
        try:
            results = await self._store.search(query, limit=limit)
            return {"results": results, "count": len(results)}
        except Exception as e:
            logger.error("memory_search_failed", error=str(e), query=query[:80])
            return {"results": [], "count": 0, "error": str(e)[:200]}

    async def _stats(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            stats = await self._store.get_memory_stats()
            if params.get("include_growth", False):
                stats["growth"] = await self._store.get_memory_growth(days=30)
            return stats
        except Exception as e:
            logger.error("memory_stats_failed", error=str(e))
            return {"error": str(e)[:200]}

    async def _health_check(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._store.evaluate_memory_health()
        except Exception as e:
            logger.error("memory_health_check_failed", error=str(e))
            return {"status": "error", "error": str(e)[:200]}

    async def _policy_current(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            effective = await self._store.get_effective_policy()

            # Read raw overrides to show which values are admin-customized
            overrides: dict = {}
            if self._state_store:
                raw = await self._state_store.get("memory_policy", {})
                if isinstance(raw, dict):
                    overrides = raw

            return {
                "effective": effective,
                "overrides": overrides,
                "defaults_source": "config.py",
            }
        except Exception as e:
            logger.error("memory_policy_current_failed", error=str(e))
            return {"error": str(e)[:200]}

    async def _policy_update(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._state_store:
            return {"error": "StateStore not available — policy overrides disabled"}

        # Validate and clamp each provided field
        errors: list[str] = []
        updates: dict[str, float | int] = {}

        for field, (lo, hi) in _POLICY_RANGES.items():
            if field not in params:
                continue
            val = params[field]
            if not isinstance(val, (int, float)):
                errors.append(f"{field}: must be a number, got {type(val).__name__}")
                continue
            if val < lo or val > hi:
                errors.append(f"{field}: {val} out of range [{lo}, {hi}]")
                continue
            # Integer fields
            if field in ("decay_days", "max_chunks"):
                updates[field] = int(val)
            else:
                updates[field] = round(float(val), 4)

        if errors:
            return {"error": "Validation failed", "details": errors}

        if not updates:
            return {"error": "No valid fields provided", "valid_fields": list(_POLICY_RANGES.keys())}

        try:
            # Merge with existing overrides (preserve fields not being changed)
            existing = await self._state_store.get("memory_policy", {})
            if not isinstance(existing, dict):
                existing = {}
            merged = {**existing, **updates}
            await self._state_store.set("memory_policy", merged)

            # Return new effective policy
            effective = await self._store.get_effective_policy()
            logger.info("memory_policy_updated", updates=updates)

            return {
                "status": "updated",
                "applied": updates,
                "effective": effective,
            }
        except Exception as e:
            logger.error("memory_policy_update_failed", error=str(e))
            return {"error": str(e)[:200]}
