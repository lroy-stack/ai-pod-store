"""
PodClaw — FastAPI Bridge
==========================

HTTP API for the Next.js admin dashboard to control PodClaw.
Runs on port 8000. Next.js /api/agent/* routes proxy here.

Endpoints:
  GET  /status              — Overall PodClaw status
  GET  /agents              — List all 8 agents with status
  GET  /agents/{name}       — Single agent detail
  POST /agents/{name}/run   — Trigger an agent manually
  POST /agents/{name}/pause — Pause scheduled runs
  POST /agents/{name}/resume — Resume scheduled runs
  POST /stop                — Emergency stop all agents
  GET  /events              — Query agent events
  GET  /metrics             — Current metrics per agent
  GET  /costs               — Daily cost breakdown
  GET  /schedule            — List scheduled jobs
  GET  /memory/daily        — Today's memory log
  GET  /memory/context/{file} — Read a context file
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from podclaw.bridge.auth import require_auth

if TYPE_CHECKING:
    from podclaw.core import Orchestrator
    from podclaw.scheduler import PodClawScheduler
    from podclaw.event_store import EventStore
    from podclaw.memory_manager import MemoryManager


def create_app(
    orchestrator: "Orchestrator",
    scheduler: "PodClawScheduler",
    event_store: "EventStore",
    memory_manager: "MemoryManager",
) -> FastAPI:
    """Create the FastAPI application with all routes."""

    app = FastAPI(
        title="PodClaw Bridge",
        description="Control API for PodClaw autonomous store manager",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5555"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ----- Status -----

    @app.get("/status", dependencies=[Depends(require_auth)])
    async def get_status():
        return orchestrator.get_status()

    # ----- Agents -----

    @app.get("/agents", dependencies=[Depends(require_auth)])
    async def list_agents():
        from podclaw.core import AGENT_NAMES
        return [orchestrator.get_agent_status(name) for name in AGENT_NAMES]

    @app.get("/agents/{name}", dependencies=[Depends(require_auth)])
    async def get_agent(name: str):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        return orchestrator.get_agent_status(name)

    @app.post("/agents/{name}/run", dependencies=[Depends(require_auth)])
    async def run_agent(name: str, task: str | None = None):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        result = await orchestrator.run_agent(name, task)
        return result

    @app.post("/agents/{name}/pause", dependencies=[Depends(require_auth)])
    async def pause_agent(name: str):
        scheduler.pause_agent(name)
        return {"status": "paused", "agent": name}

    @app.post("/agents/{name}/resume", dependencies=[Depends(require_auth)])
    async def resume_agent(name: str):
        scheduler.resume_agent(name)
        return {"status": "resumed", "agent": name}

    # ----- Emergency Stop -----

    @app.post("/stop", dependencies=[Depends(require_auth)])
    async def emergency_stop():
        orchestrator.stop()
        scheduler.stop()
        return {"status": "stopped", "message": "All agents halted"}

    # ----- Events -----

    @app.get("/events", dependencies=[Depends(require_auth)])
    async def get_events(
        agent: str | None = None,
        event_type: str | None = None,
        limit: int = Query(default=50, le=500),
    ):
        events = await event_store.query(
            agent_name=agent,
            event_type=event_type,
            limit=limit,
        )
        return {"events": events, "count": len(events)}

    # ----- Metrics -----

    @app.get("/metrics", dependencies=[Depends(require_auth)])
    async def get_metrics():
        from podclaw.hooks.metrics_hook import get_metrics
        return get_metrics()

    # ----- Costs -----

    @app.get("/costs", dependencies=[Depends(require_auth)])
    async def get_costs():
        from podclaw.hooks.cost_guard_hook import get_daily_costs
        return get_daily_costs()

    # ----- Schedule -----

    @app.get("/schedule", dependencies=[Depends(require_auth)])
    async def get_schedule():
        """Get full schedule configuration with job status."""
        return scheduler.get_full_schedule()

    @app.put("/schedule", dependencies=[Depends(require_auth)])
    async def update_schedule(body: dict):
        """Update agent schedules and persist changes."""
        if "schedule" not in body:
            raise HTTPException(400, "Missing 'schedule' field in request body")

        try:
            result = scheduler.update_schedule(body["schedule"])
            return result
        except Exception as e:
            raise HTTPException(400, f"Failed to update schedule: {str(e)}")

    @app.post("/schedule", dependencies=[Depends(require_auth)])
    async def reset_schedule(body: dict):
        """Reset schedule to default configuration."""
        if body.get("action") != "reset":
            raise HTTPException(400, "Invalid action. Use {\"action\": \"reset\"}")

        try:
            result = scheduler.reset_to_defaults()
            return result
        except Exception as e:
            raise HTTPException(400, f"Failed to reset schedule: {str(e)}")

    # ----- Memory -----

    @app.get("/memory/daily", dependencies=[Depends(require_auth)])
    async def get_daily_memory():
        path = memory_manager._daily_log_path()
        if path.exists():
            return {"content": path.read_text(), "date": path.stem}
        return {"content": "", "date": path.stem}

    @app.get("/memory/context/{filename}", dependencies=[Depends(require_auth)])
    async def get_context_file(filename: str):
        content = memory_manager.read_context(filename)
        if not content:
            raise HTTPException(404, f"Context file not found: {filename}")
        return {"content": content, "filename": filename}

    @app.get("/memory/soul", dependencies=[Depends(require_auth)])
    async def get_soul():
        return {"content": memory_manager.read_soul()}

    # ----- Health -----

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "podclaw-bridge"}

    return app
