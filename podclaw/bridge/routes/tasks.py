# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Natural language task endpoints: create, poll, list."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request

import structlog

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState
from podclaw.bridge.models import TaskRequest

logger = structlog.get_logger(__name__)


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register task endpoints."""

    async def _classify_task(message: str) -> list[str]:
        """Use Haiku to decide which agent(s) should handle this message."""
        from podclaw.llm_helper import quick_llm_call
        from podclaw.core import AGENT_NAMES

        logger.info("classify_task_start", message=message[:80])
        text = await quick_llm_call(
            system_prompt=(
                "You are a JSON-only routing function. No explanations. No commentary.\n"
                "You MUST respond with ONLY a raw JSON array. Nothing before or after it.\n\n"
                "Available agents:\n"
                "researcher, marketing, designer, cataloger, "
                "customer_support, finance, qa_inspector\n\n"
                "Rules:\n"
                "- Pick 1-3 agents needed for the task\n"
                "- Output format: [\"agent1\", \"agent2\"]\n"
                "- NO text, NO markdown, NO explanation\n"
            ),
            user_prompt=f"Route this task: {message}",
            model="claude-haiku-4-5-20251001",
            max_budget=0.005,
        )

        logger.info("classify_task_raw", raw_text=repr(text[:300]))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        if not text.startswith("["):
            match = re.search(r'\[.*?\]', text, re.DOTALL)
            if match:
                text = match.group(0)
                logger.info("classify_task_extracted", extracted=text[:200])
            else:
                found = [a for a in AGENT_NAMES if a in text.lower()]
                if found:
                    logger.info("classify_task_fallback_names", agents=found)
                    return found
                raise ValueError(f"Could not extract agent list from: {text[:100]}")

        logger.info("classify_task_parsed", clean_text=repr(text[:200]))
        agents = json.loads(text)
        valid = [a for a in agents if a in AGENT_NAMES]
        logger.info("classify_task_result", agents=valid)
        return valid

    async def _build_task_summary(
        message: str, progress: list[dict[str, Any]]
    ) -> str:
        """Use Haiku to consolidate all agent responses into one executive summary."""
        agent_outputs = "\n\n".join(
            f"[{p['agent']}] ({p['tool_calls']} tools, ${p['cost_usd']:.3f}):\n{p.get('response', '(no response)')}"
            for p in progress
        )
        try:
            from podclaw.llm_helper import quick_llm_call
            return await quick_llm_call(
                system_prompt=(
                    "You consolidate reports from multiple AI agents into one executive summary.\n"
                    "Be concise, actionable, in the same language as the user's request.\n"
                    "Highlight: key findings, problems found, recommended actions.\n"
                    "Max 500 words."
                ),
                user_prompt=(
                    f"Original request: {message[:500]}\n\n"
                    f"Agent reports:\n{agent_outputs[:3000]}"
                ),
                model="claude-haiku-4-5-20251001",
                max_budget=0.01,
            )
        except Exception as e:
            logger.warning("summary_generation_failed", error=str(e))
            return ""

    async def _route_and_execute(task_id: str, message: str) -> None:
        """Background coroutine: classify -> run agent(s) -> store results."""
        state.tasks[task_id]["status"] = "routing"

        try:
            agents = await _classify_task(message)
            state.tasks[task_id]["agents"] = agents
            state.tasks[task_id]["status"] = "running"
            state.tasks[task_id]["progress"] = []

            total_cost = 0.0
            for agent_name in agents:
                state.tasks[task_id]["current_agent"] = agent_name
                logger.info("task_agent_start", task_id=task_id[:8], agent=agent_name)

                result = await deps.orchestrator.run_agent(agent_name, task=message, force_fresh=True)
                cost = result.get("total_cost_usd") or 0
                total_cost += cost

                response_text = result.get("response", "")
                state.tasks[task_id]["progress"].append({
                    "agent": agent_name,
                    "status": result.get("status", "unknown"),
                    "tool_calls": result.get("tool_calls", 0),
                    "cost_usd": round(cost, 3),
                    "duration_s": round(result.get("duration_seconds", 0)),
                    "session_id": result.get("session_id", ""),
                    "response": response_text[:1000] if response_text else "",
                })

                logger.info("task_agent_done", task_id=task_id[:8], agent=agent_name,
                            status=result.get("status"), tools=result.get("tool_calls", 0),
                            cost=round(cost, 3))

            state.tasks[task_id]["status"] = "completed"
            state.tasks[task_id]["total_cost_usd"] = round(total_cost, 3)
            state.tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

            state.tasks[task_id]["summary"] = await _build_task_summary(
                message, state.tasks[task_id]["progress"]
            )

        except Exception as e:
            state.tasks[task_id]["status"] = "error"
            state.tasks[task_id]["error"] = str(e)
            logger.error("task_failed", task_id=task_id[:8], error=str(e))

    # ----- Endpoints -----

    @app.post("/task", dependencies=[Depends(require_auth)])
    async def create_task(body: TaskRequest, request: Request, background_tasks: BackgroundTasks):
        """Send a natural language task to PodClaw."""
        tenant_id = body.tenant_id or request.headers.get("x-tenant-id")

        task_id = str(uuid.uuid4())
        state.tasks[task_id] = {
            "task_id": task_id,
            "message": body.message,
            "tenant_id": tenant_id,
            "status": "accepted",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "agents": [],
            "progress": [],
        }
        background_tasks.add_task(_route_and_execute, task_id, body.message)
        logger.info("task_accepted", task_id=task_id[:8], message=body.message[:80], tenant_id=tenant_id)
        return {"task_id": task_id, "status": "accepted", "tenant_id": tenant_id}

    @app.get("/task/{task_id}", dependencies=[Depends(require_auth)])
    async def get_task(task_id: str):
        """Check status and progress of a running or completed task."""
        if task_id not in state.tasks:
            raise HTTPException(404, f"Task not found: {task_id}")
        return state.tasks[task_id]

    @app.get("/tasks", dependencies=[Depends(require_auth)])
    async def list_tasks(limit: int = Query(default=20, le=100)):
        """List recent tasks, newest first."""
        sorted_tasks = sorted(
            state.tasks.values(),
            key=lambda t: t.get("created_at", ""),
            reverse=True,
        )
        return {"tasks": sorted_tasks[:limit], "count": len(state.tasks)}
