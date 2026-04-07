# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Agent management endpoints: list, run, pause, resume, disable, enable."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException

import structlog

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState
from podclaw.bridge.models import AgentRunRequest

logger = structlog.get_logger(__name__)


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register agent management endpoints."""

    async def _run_single_agent(task_id: str, agent_name: str, task_prompt: str | None) -> None:
        """Background coroutine: run a single agent and store results."""
        state.tasks[task_id]["status"] = "running"
        state.tasks[task_id]["current_agent"] = agent_name

        try:
            logger.info("agent_run_start", task_id=task_id[:8], agent=agent_name)
            result = await deps.orchestrator.run_agent(agent_name, task=task_prompt, force_fresh=True)

            cost = result.get("total_cost_usd") or 0
            response_text = result.get("response", "")

            state.tasks[task_id]["status"] = "completed"
            state.tasks[task_id]["result"] = {
                "agent": agent_name,
                "status": result.get("status", "unknown"),
                "tool_calls": result.get("tool_calls", 0),
                "cost_usd": round(cost, 3),
                "duration_s": round(result.get("duration_seconds", 0)),
                "session_id": result.get("session_id", ""),
                "response": response_text,
            }
            state.tasks[task_id]["total_cost_usd"] = round(cost, 3)
            state.tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

            logger.info("agent_run_done", task_id=task_id[:8], agent=agent_name,
                        status=result.get("status"), tools=result.get("tool_calls", 0),
                        cost=round(cost, 3))

        except Exception as e:
            state.tasks[task_id]["status"] = "error"
            state.tasks[task_id]["error"] = str(e)
            logger.error("agent_run_failed", task_id=task_id[:8], agent=agent_name, error=str(e))

    # ----- List / Detail -----

    @app.get("/agents", dependencies=[Depends(require_auth)])
    async def list_agents():
        from podclaw.core import AGENT_NAMES
        return [deps.orchestrator.get_agent_status(name) for name in AGENT_NAMES]

    @app.get("/agents/{name}", dependencies=[Depends(require_auth)])
    async def get_agent(name: str):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        return deps.orchestrator.get_agent_status(name)

    # ----- Run -----

    @app.post("/agents/{name}/run", dependencies=[Depends(require_auth)])
    async def run_agent(name: str, body: AgentRunRequest | None = None, background_tasks: BackgroundTasks = None):
        """Trigger an agent manually (non-blocking)."""
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")

        task = body.task if body else None
        task_id = str(uuid.uuid4())

        state.tasks[task_id] = {
            "task_id": task_id,
            "agent": name,
            "task": task or "(default task)",
            "status": "accepted",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if background_tasks:
            background_tasks.add_task(_run_single_agent, task_id, name, task)
        else:
            asyncio.create_task(_run_single_agent(task_id, name, task))

        logger.info("agent_run_accepted", task_id=task_id[:8], agent=name, task=task[:80] if task else "default")
        return {"task_id": task_id, "status": "accepted", "agent": name}

    # ----- Pause / Resume -----

    @app.post("/agents/{name}/pause", dependencies=[Depends(require_auth)])
    async def pause_agent(name: str):
        deps.scheduler.pause_agent(name)
        return {"status": "paused", "agent": name}

    @app.post("/agents/{name}/resume", dependencies=[Depends(require_auth)])
    async def resume_agent(name: str):
        deps.scheduler.resume_agent(name)
        return {"status": "resumed", "agent": name}

    # ----- Sub-agent alias -----

    @app.post("/subagent/{name}/run", dependencies=[Depends(require_auth)])
    async def run_subagent(name: str, body: AgentRunRequest | None = None, background_tasks: BackgroundTasks = None):
        """Trigger a sub-agent manually (non-blocking alias)."""
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")

        task = body.task if body else None
        task_id = str(uuid.uuid4())

        state.tasks[task_id] = {
            "task_id": task_id,
            "agent": name,
            "task": task or "(default task)",
            "status": "accepted",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if background_tasks:
            background_tasks.add_task(_run_single_agent, task_id, name, task)
        else:
            asyncio.create_task(_run_single_agent(task_id, name, task))

        logger.info("subagent_run_accepted", task_id=task_id[:8], agent=name, task=task[:80] if task else "default")
        return {"task_id": task_id, "status": "accepted", "agent": name}

    # ----- Kill-Switch -----

    @app.post("/agents/{name}/disable", dependencies=[Depends(require_auth)])
    async def disable_agent(name: str):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        await deps.orchestrator.disable_agent(name)
        return {"status": "disabled", "agent": name}

    @app.post("/agents/{name}/enable", dependencies=[Depends(require_auth)])
    async def enable_agent(name: str):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        await deps.orchestrator.enable_agent(name)
        return {"status": "enabled", "agent": name}
