"""
PodClaw — FastAPI Bridge
==========================

HTTP API for the Next.js admin dashboard to control PodClaw.
Runs on port 8000. Next.js /api/agent/* routes proxy here.

Endpoints:
  POST /start               — Start the orchestrator
  GET  /status              — Overall PodClaw status
  POST /stop                — Emergency stop all agents
  GET  /agents              — List all 8 agents with status
  GET  /agents/{name}       — Single agent detail
  POST /agents/{name}/run   — Trigger an agent manually
  POST /agents/{name}/pause — Pause scheduled runs
  POST /agents/{name}/resume — Resume scheduled runs
  POST /subagent/{name}/run — Alias: trigger a sub-agent
  GET  /events              — Query agent events
  GET  /sessions            — Query agent sessions
  GET  /sessions/{id}/events — Events for a specific session
  GET  /metrics             — Current metrics per agent
  GET  /costs               — Daily cost breakdown
  GET  /skills              — List all agent skills
  GET  /schedule            — List scheduled jobs
  PUT  /schedule/{agent}    — Update single agent schedule
  GET  /memory              — Aggregated memory view
  GET  /memory/daily        — Today's memory log
  GET  /memory/context/{file} — Read a context file
  GET  /memory/soul         — Read SOUL.md
  GET  /memory/heartbeat    — Read HEARTBEAT.md
  PUT  /memory/heartbeat    — Update HEARTBEAT.md
  GET  /heartbeat/status    — Heartbeat runner status
  POST /heartbeat/trigger   — Trigger manual heartbeat
  POST /heartbeat/pause     — Pause heartbeat
  POST /heartbeat/resume    — Resume heartbeat
  GET  /heartbeat/alerts    — Query heartbeat alerts
  GET  /queue               — Peek at event queue
  POST /queue/push          — Push manual event
  GET  /soul                — Read SOUL.md
  GET  /soul/proposals      — Pending soul proposals
  POST /soul/proposals/{id}/approve — Approve proposal
  POST /soul/proposals/{id}/reject  — Reject proposal
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from podclaw.bridge.auth import require_auth

if TYPE_CHECKING:
    from podclaw.core import Orchestrator
    from podclaw.scheduler import PodClawScheduler
    from podclaw.event_store import EventStore
    from podclaw.memory_manager import MemoryManager
    from podclaw.heartbeat import HeartbeatRunner
    from podclaw.event_queue import SystemEventQueue
    from podclaw.soul_evolution import SoulEvolution


def create_app(
    orchestrator: "Orchestrator",
    scheduler: "PodClawScheduler",
    event_store: "EventStore",
    memory_manager: "MemoryManager",
    heartbeat: "HeartbeatRunner | None" = None,
    event_queue: "SystemEventQueue | None" = None,
    soul_evolution: "SoulEvolution | None" = None,
) -> FastAPI:
    """Create the FastAPI application with all routes."""

    app = FastAPI(
        title="PodClaw Bridge",
        description="Control API for PodClaw autonomous store manager",
        version="0.2.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5555"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ----- Start / Status -----

    @app.post("/start", dependencies=[Depends(require_auth)])
    async def start_orchestrator():
        orchestrator.start()
        return orchestrator.get_status()

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

    # ----- Sub-agent alias (tests expect /subagent/{name}/run) -----

    @app.post("/subagent/{name}/run", dependencies=[Depends(require_auth)])
    async def run_subagent(name: str, task: str | None = None):
        from podclaw.core import AGENT_NAMES
        if name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {name}")
        result = await orchestrator.run_agent(name, task)
        return result

    # ----- Emergency Stop -----

    @app.post("/stop", dependencies=[Depends(require_auth)])
    async def emergency_stop():
        orchestrator.stop()
        scheduler.stop()
        if heartbeat:
            heartbeat.stop()
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

    # ----- Sessions -----

    @app.get("/sessions", dependencies=[Depends(require_auth)])
    async def get_sessions(
        agent: str | None = None,
        limit: int = Query(default=20, le=100),
    ):
        sessions = await event_store.query_sessions(
            agent_name=agent,
            limit=limit,
        )
        return {"sessions": sessions, "count": len(sessions)}

    @app.get("/sessions/{session_id}/events", dependencies=[Depends(require_auth)])
    async def get_session_events(session_id: str):
        events = await event_store.get_session_events(session_id)
        return {"session_id": session_id, "events": events, "count": len(events)}

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

    # ----- Skills -----

    @app.get("/skills", dependencies=[Depends(require_auth)])
    async def get_skills():
        """List all agent skills (SKILL.md files)."""
        from pathlib import Path
        from podclaw.core import AGENT_NAMES

        skills_dir = Path(__file__).resolve().parent.parent / "skills"
        skills = []
        for agent_name in AGENT_NAMES:
            skill_file = skills_dir / agent_name / "SKILL.md"
            if skill_file.exists():
                content = skill_file.read_text()
                skills.append({
                    "agent": agent_name,
                    "skill_file": str(skill_file),
                    "content": content[:2000],
                    "has_templates": (skills_dir / agent_name / "templates").is_dir(),
                })
        return {"skills": skills, "count": len(skills)}

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

    @app.put("/schedule/{agent_name}", dependencies=[Depends(require_auth)])
    async def update_agent_schedule(agent_name: str, body: dict):
        """Update schedule for a single agent."""
        from podclaw.core import AGENT_NAMES
        if agent_name not in AGENT_NAMES:
            raise HTTPException(404, f"Unknown agent: {agent_name}")

        schedule_cron = body.get("schedule")
        if not schedule_cron:
            raise HTTPException(400, "Missing 'schedule' field")

        # Build a single-agent update list
        current = scheduler.current_schedule.get(agent_name, {})
        update_entry = {
            "name": agent_name,
            "schedule": schedule_cron,
            "description": body.get("description", current.get("description", "")),
            "model": body.get("model", current.get("model", "sonnet")),
            "enabled": body.get("enabled", current.get("enabled", True)),
        }

        # Rebuild full schedule list preserving other agents
        full_schedule = []
        for name, config in scheduler.current_schedule.items():
            if name == agent_name:
                full_schedule.append(update_entry)
            else:
                full_schedule.append({"name": name, **config})

        try:
            result = scheduler.update_schedule(full_schedule)
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

    @app.get("/memory", dependencies=[Depends(require_auth)])
    async def get_memory():
        """Aggregated memory view: MEMORY.md + daily log + context file list."""
        from pathlib import Path

        long_term = memory_manager.read_memory()
        soul = memory_manager.read_soul()

        daily_path = memory_manager._daily_log_path()
        daily = daily_path.read_text() if daily_path.exists() else ""

        context_dir = memory_manager.workspace / "memory" / "context"
        context_files = []
        if context_dir.is_dir():
            for f in sorted(context_dir.iterdir()):
                if f.suffix == ".md":
                    context_files.append(f.name)

        return {
            "memory": long_term,
            "soul": soul[:1000] if soul else "",
            "daily": daily,
            "context_files": context_files,
        }

    @app.get("/memory/daily", dependencies=[Depends(require_auth)])
    async def get_daily_memory():
        path = memory_manager._daily_log_path()
        if path.exists():
            return {"content": path.read_text(), "date": path.stem}
        return {"content": "", "date": path.stem}

    @app.get("/memory/context/{filename}", dependencies=[Depends(require_auth)])
    async def get_context_file(filename: str):
        try:
            content = memory_manager.read_context(filename)
        except ValueError as e:
            raise HTTPException(400, str(e))
        if not content:
            raise HTTPException(404, f"Context file not found: {filename}")
        return {"content": content, "filename": filename}

    @app.get("/memory/soul", dependencies=[Depends(require_auth)])
    async def get_soul_legacy():
        return {"content": memory_manager.read_soul()}

    @app.post("/memory/consolidate", dependencies=[Depends(require_auth)])
    async def run_consolidation():
        """Trigger memory consolidation cycle manually."""
        await orchestrator.run_consolidation()
        return {"status": "ok", "message": "Memory consolidation completed"}

    # ----- Memory: HEARTBEAT.md -----

    @app.get("/memory/heartbeat", dependencies=[Depends(require_auth)])
    async def get_heartbeat_md():
        """Read the HEARTBEAT.md checklist."""
        return {"content": memory_manager.read_heartbeat()}

    @app.put("/memory/heartbeat", dependencies=[Depends(require_auth)])
    async def update_heartbeat_md(body: dict):
        """Update the HEARTBEAT.md checklist."""
        content = body.get("content")
        if content is None:
            raise HTTPException(400, "Missing 'content' field")
        await memory_manager.update_heartbeat(content)
        return {"status": "ok"}

    # ----- Heartbeat Runner -----

    @app.get("/heartbeat/status", dependencies=[Depends(require_auth)])
    async def get_heartbeat_status():
        """Get heartbeat runner status."""
        if not heartbeat:
            return {"running": False, "message": "Heartbeat not initialized"}
        return heartbeat.get_status()

    @app.post("/heartbeat/trigger", dependencies=[Depends(require_auth)])
    async def trigger_heartbeat():
        """Trigger a manual heartbeat cycle."""
        if not heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        result = await heartbeat.run_once()
        return result

    @app.post("/heartbeat/pause", dependencies=[Depends(require_auth)])
    async def pause_heartbeat():
        """Pause the heartbeat runner."""
        if not heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        heartbeat.pause()
        return {"status": "paused"}

    @app.post("/heartbeat/resume", dependencies=[Depends(require_auth)])
    async def resume_heartbeat():
        """Resume the heartbeat runner."""
        if not heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        heartbeat.resume()
        return {"status": "resumed"}

    @app.get("/heartbeat/alerts", dependencies=[Depends(require_auth)])
    async def get_heartbeat_alerts(
        limit: int = Query(default=20, le=100),
    ):
        """Query recent heartbeat alerts from heartbeat_events table."""
        import asyncio
        if not event_store._client:
            return {"alerts": [], "count": 0}

        try:
            result = await asyncio.to_thread(
                lambda: (
                    event_store._client.table("heartbeat_events")
                    .select("*")
                    .in_("event_type", ["alert", "dispatch"])
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
            )
            alerts = result.data if result.data else []
            return {"alerts": alerts, "count": len(alerts)}
        except Exception as e:
            raise HTTPException(500, f"Failed to query alerts: {str(e)}")

    # ----- Event Queue -----

    @app.get("/queue", dependencies=[Depends(require_auth)])
    async def peek_queue():
        """Peek at the system event queue without draining."""
        if not event_queue:
            return {"events": [], "size": 0}
        events = await event_queue.peek()
        return {
            "events": [e.to_dict() for e in events],
            "size": event_queue.size,
        }

    class QueuePushRequest(BaseModel):
        source: str = Field(default="admin", max_length=50)
        event_type: str = Field(default="message", max_length=50)
        payload: dict = Field(default_factory=dict)
        wake_mode: str = Field(default="next-heartbeat", pattern=r"^(now|next-heartbeat)$")
        target_agent: str | None = Field(default=None, max_length=50)

    @app.post("/queue/push", dependencies=[Depends(require_auth)])
    async def push_queue_event(body: QueuePushRequest):
        """Push a manual event to the system event queue."""
        if not event_queue:
            raise HTTPException(503, "Event queue not initialized")

        # Limit payload size (10KB)
        import json as _json
        payload_str = _json.dumps(body.payload)
        if len(payload_str) > 10_240:
            raise HTTPException(400, "Payload exceeds 10KB limit")

        from podclaw.event_queue import SystemEvent
        event = SystemEvent(
            source=body.source,
            event_type=body.event_type,
            payload=body.payload,
            created_at=datetime.now(timezone.utc),
            wake_mode=body.wake_mode,
            target_agent=body.target_agent,
        )
        added = await event_queue.push(event)
        return {"status": "ok", "added": added, "queue_size": event_queue.size}

    # ----- Soul Evolution -----

    @app.get("/soul", dependencies=[Depends(require_auth)])
    async def get_soul():
        """Read the full SOUL.md content."""
        return {"content": memory_manager.read_soul()}

    @app.get("/soul/proposals", dependencies=[Depends(require_auth)])
    async def get_soul_proposals():
        """List pending soul evolution proposals."""
        if not soul_evolution:
            return {"proposals": [], "count": 0}
        proposals = soul_evolution.get_pending_proposals()
        return {"proposals": proposals, "count": len(proposals)}

    @app.post("/soul/proposals/{proposal_id}/approve", dependencies=[Depends(require_auth)])
    async def approve_soul_proposal(proposal_id: str):
        """Approve and apply a pending soul proposal."""
        if not soul_evolution:
            raise HTTPException(503, "Soul evolution not initialized")
        success = await soul_evolution.apply_proposal(proposal_id)
        if not success:
            raise HTTPException(404, f"Proposal not found: {proposal_id}")
        return {"status": "approved", "proposal_id": proposal_id}

    @app.post("/soul/proposals/{proposal_id}/reject", dependencies=[Depends(require_auth)])
    async def reject_soul_proposal(proposal_id: str, body: dict | None = None):
        """Reject a pending soul proposal."""
        if not soul_evolution:
            raise HTTPException(503, "Soul evolution not initialized")
        reason = (body or {}).get("reason", "")
        success = await soul_evolution.reject_proposal(proposal_id, reason)
        if not success:
            raise HTTPException(404, f"Proposal not found: {proposal_id}")
        return {"status": "rejected", "proposal_id": proposal_id}

    # ----- Health -----

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": "podclaw-bridge",
            "heartbeat": heartbeat.get_status() if heartbeat else None,
            "queue_size": event_queue.size if event_queue else 0,
        }

    return app
