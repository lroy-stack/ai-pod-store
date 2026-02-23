"""
Delegate MCP Connector — conscious sub-agent delegation from chat.
====================================================================

Exposes a `delegate_agent` tool that PodClaw can invoke during chat
to dispatch tasks to specialized sub-agents. Unlike the legacy mechanical
router, delegation here is a conscious LLM decision with:

- Explicit reason justification (audit trail)
- Confirmation gate for sensitive agents (cost / public visibility)
- Async execution when delegation_registry is provided (non-blocking)
- Sync fallback for scheduler/manual runs (backward compat)

All orchestrator protections (circuit breaker, concurrency lock, timeout,
cost guard, rate limit) are inherited from orchestrator.run_agent().
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from podclaw.delegation import DelegationRegistry

logger = structlog.get_logger(__name__)

# Agents that cost money (fal.ai, Printify) or affect public content
# require explicit admin confirmation via confirmed=true.
SENSITIVE_AGENTS = frozenset({"designer", "marketing", "newsletter", "cataloger"})


class DelegateMCPConnector:
    """MCP connector exposing delegate_agent tool to PodClaw chat sessions."""

    def __init__(
        self,
        orchestrator: Any,
        delegation_registry: "DelegationRegistry | None" = None,
        conversation_id: str | None = None,
    ):
        self._orchestrator = orchestrator
        self._registry = delegation_registry
        self._conversation_id = conversation_id

    def get_tools(self) -> dict[str, dict[str, Any]]:
        from podclaw.core import AGENT_NAMES

        return {
            "delegate_agent": {
                "description": (
                    "Delegate a task to a specialized sub-agent. Use this when a task "
                    "requires a full agent cycle (>30 seconds) — e.g., creating designs, "
                    "running SEO audits, analyzing competitors, sending newsletters. "
                    "Do NOT delegate simple data lookups you can handle with existing tools. "
                    "For sensitive agents (designer, marketing, newsletter, cataloger), "
                    "you must get admin confirmation first and set confirmed=true."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "agent_name": {
                            "type": "string",
                            "enum": list(AGENT_NAMES),
                            "description": "The sub-agent to delegate to",
                        },
                        "task": {
                            "type": "string",
                            "description": (
                                "Specific task instruction for the agent. "
                                "Be clear and detailed — the agent runs independently."
                            ),
                        },
                        "reason": {
                            "type": "string",
                            "description": (
                                "Why this delegation is needed. "
                                "Logged for audit trail and admin transparency."
                            ),
                        },
                        "confirmed": {
                            "type": "boolean",
                            "default": False,
                            "description": (
                                "Set to true after the admin explicitly confirms. "
                                "Required for sensitive agents (designer, marketing, "
                                "newsletter, cataloger)."
                            ),
                        },
                    },
                    "required": ["agent_name", "task", "reason"],
                },
                "handler": self._delegate,
            },
        }

    async def _delegate(self, params: dict[str, Any]) -> dict[str, Any]:
        agent_name = params.get("agent_name", "")
        task = params.get("task", "")
        reason = params.get("reason", "")
        confirmed = params.get("confirmed", False)

        # Validate agent name
        from podclaw.core import AGENT_NAMES

        if agent_name not in AGENT_NAMES:
            return {
                "status": "error",
                "message": f"Unknown agent: '{agent_name}'. Valid agents: {', '.join(AGENT_NAMES)}",
            }

        if not task.strip():
            return {"status": "error", "message": "Task cannot be empty."}

        if not reason.strip():
            return {"status": "error", "message": "Reason cannot be empty."}

        # Safety gate: sensitive agents require explicit confirmation
        if agent_name in SENSITIVE_AGENTS and not confirmed:
            logger.info(
                "delegate_confirmation_required",
                agent=agent_name,
                reason=reason[:200],
            )
            return {
                "status": "confirmation_required",
                "agent": agent_name,
                "task": task[:200],
                "message": (
                    f"Delegating to '{agent_name}' requires admin confirmation "
                    f"because this agent costs money or affects public content. "
                    f"Ask the admin to confirm, then call again with confirmed=true."
                ),
            }

        # Log delegation for audit
        logger.info(
            "delegate_agent",
            agent=agent_name,
            reason=reason[:200],
            task_preview=task[:100],
            confirmed=confirmed,
        )

        # ASYNC path — non-blocking delegation via DelegationWorker
        if self._registry and self._conversation_id:
            from podclaw.delegation import DelegationRequest

            delegation_id = str(uuid.uuid4())
            req = DelegationRequest(
                id=delegation_id,
                conversation_id=self._conversation_id,
                agent_name=agent_name,
                task=task,
                reason=reason,
                status="pending",
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            await self._registry.register(req)

            return {
                "status": "delegated",
                "delegation_id": delegation_id,
                "agent": agent_name,
                "reason": reason,
                "message": (
                    f"Task delegated to {agent_name}. The admin can continue "
                    f"chatting. Results will appear in the next message."
                ),
            }

        # SYNC fallback — blocking execution (scheduler, manual /agents/{name}/run)
        # orchestrator.run_agent() has its own circuit breaker, concurrency lock,
        # timeout (900s), cost guard, and rate limiting.
        result = await self._orchestrator.run_agent(agent_name, task=task)

        return {
            "status": result.get("status", "unknown"),
            "agent": agent_name,
            "reason": reason,
            "duration_seconds": result.get("duration_seconds"),
            "tool_calls": result.get("tool_calls", 0),
            "cost_usd": result.get("total_cost_usd"),
            "response_preview": (result.get("response") or "")[:1000],
            "error": result.get("error"),
        }
