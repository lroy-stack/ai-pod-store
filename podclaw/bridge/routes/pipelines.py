# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Pipeline engine endpoints: list, execute, active."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register pipeline endpoints."""

    @app.get("/pipelines", dependencies=[Depends(require_auth)])
    async def list_pipelines():
        """List all registered pipeline templates."""
        from podclaw.pipeline_engine import PIPELINE_REGISTRY

        return {
            "pipelines": [
                {
                    "name": p.name,
                    "description": p.description,
                    "steps": [s.name for s in p.steps],
                    "agents": [s.agent for s in p.steps],
                }
                for p in PIPELINE_REGISTRY.values()
            ]
        }

    @app.post("/pipelines/{name}/execute", dependencies=[Depends(require_auth)])
    async def execute_pipeline(name: str, request: Request, background_tasks: BackgroundTasks):
        """Execute a registered pipeline by name."""
        from podclaw.pipeline_engine import PIPELINE_REGISTRY

        pipeline = PIPELINE_REGISTRY.get(name)
        if not pipeline:
            raise HTTPException(status_code=404, detail=f"Pipeline '{name}' not found")

        body = await request.json() if await request.body() else {}
        variables = body.get("variables", {})

        pe = getattr(deps.event_dispatcher, "pipeline_engine", None)
        if not pe:
            raise HTTPException(status_code=503, detail="Pipeline engine not initialized")

        task_id = str(uuid.uuid4())

        async def _run():
            try:
                result = await pe.execute(pipeline, variables, source="bridge")
                state.tasks[task_id]["status"] = "completed"
                state.tasks[task_id]["pipeline_status"] = result.status
                state.tasks[task_id]["steps_completed"] = len(result.step_results)
                state.tasks[task_id]["total_cost_usd"] = round(result.total_cost_usd, 3)
                state.tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
            except Exception as e:
                state.tasks[task_id]["status"] = "error"
                state.tasks[task_id]["error"] = str(e)[:500]

        state.tasks[task_id] = {
            "id": task_id,
            "type": f"pipeline:{name}",
            "status": "running",
            "variables": variables,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        background_tasks.add_task(_run)
        return {"task_id": task_id, "pipeline": name, "status": "started"}

    @app.get("/pipelines/active", dependencies=[Depends(require_auth)])
    async def get_active_pipelines():
        """Get status of currently running pipelines."""
        pe = getattr(deps.event_dispatcher, "pipeline_engine", None)
        if not pe:
            return {"active": {}}
        return {"active": pe.get_active_pipelines()}
