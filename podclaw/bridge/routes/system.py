# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""System, health, schedule, events, metrics, readonly endpoints."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Response

import structlog

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState

logger = structlog.get_logger(__name__)


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register system/operational endpoints."""

    # ----- Health -----

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": "podclaw-bridge",
            "heartbeat": deps.heartbeat.get_status() if deps.heartbeat else None,
            "queue_size": deps.event_queue.size if deps.event_queue else 0,
        }

    @app.get("/api/health")
    async def api_health():
        """Deep health check with sub-component status."""
        checks: dict[str, dict[str, Any]] = {}

        checks["orchestrator"] = {"ok": deps.orchestrator.is_running}

        if deps.heartbeat:
            hb_status = deps.heartbeat.get_status()
            hb_ok = hb_status.get("running", False)
            if hb_status.get("last_run"):
                from datetime import datetime as _dt, timezone as _tz
                try:
                    last = _dt.fromisoformat(hb_status["last_run"])
                    gap = (_dt.now(_tz.utc) - last).total_seconds() / 60
                    hb_ok = hb_ok and gap < deps.heartbeat.interval_minutes * 2.5
                except Exception:
                    pass
            checks["heartbeat"] = {"ok": hb_ok, **hb_status}
        else:
            checks["heartbeat"] = {"ok": False, "reason": "not initialized"}

        if deps.event_store._client:
            try:
                result = await asyncio.to_thread(
                    lambda: deps.event_store._client.table("agent_events")
                    .select("id")
                    .limit(1)
                    .execute()
                )
                checks["supabase"] = {"ok": True}
            except Exception as e:
                checks["supabase"] = {"ok": False, "error": str(e)[:200]}
        else:
            checks["supabase"] = {"ok": False, "reason": "no client"}

        try:
            jobs = deps.scheduler.get_jobs()
            checks["scheduler"] = {"ok": len(jobs) > 0, "job_count": len(jobs)}
        except Exception:
            checks["scheduler"] = {"ok": False}

        checks["event_queue"] = {
            "ok": True,
            "size": deps.event_queue.size if deps.event_queue else 0,
        }

        overall = all(v.get("ok") for v in checks.values())
        return {"status": "ok" if overall else "degraded", "checks": checks}

    # ----- Start / Status / Stop -----

    @app.post("/start", dependencies=[Depends(require_auth)])
    async def start_orchestrator():
        deps.orchestrator.start()
        return deps.orchestrator.get_status()

    @app.get("/status", dependencies=[Depends(require_auth)])
    async def get_status():
        return deps.orchestrator.get_status()

    @app.post("/stop", dependencies=[Depends(require_auth)])
    async def emergency_stop():
        deps.orchestrator.stop()
        deps.scheduler.stop()
        if deps.heartbeat:
            deps.heartbeat.stop()
        return {"status": "stopped", "message": "All agents halted"}

    # ----- Events -----

    @app.get("/events", dependencies=[Depends(require_auth)])
    async def get_events(
        agent: str | None = None,
        event_type: str | None = None,
        limit: int = Query(default=50, le=500),
    ):
        events = await deps.event_store.query(
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
        sessions = await deps.event_store.query_sessions(
            agent_name=agent,
            limit=limit,
        )
        return {"sessions": sessions, "count": len(sessions)}

    @app.get("/sessions/{session_id}/events", dependencies=[Depends(require_auth)])
    async def get_session_events(session_id: str):
        events = await deps.event_store.get_session_events(session_id)
        return {"session_id": session_id, "events": events, "count": len(events)}

    # ----- Metrics -----

    @app.get("/metrics", dependencies=[Depends(require_auth)])
    async def get_metrics():
        from podclaw.prometheus_metrics import get_prometheus_metrics, get_content_type

        metrics_data = get_prometheus_metrics()
        return Response(content=metrics_data, media_type=get_content_type())

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

        skills_dir = Path(__file__).resolve().parent.parent.parent / "skills"
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
        return deps.scheduler.get_full_schedule()

    @app.put("/schedule", dependencies=[Depends(require_auth)])
    async def update_schedule(body: dict):
        """Update agent schedules and persist changes."""
        if "schedule" not in body:
            raise HTTPException(400, "Missing 'schedule' field in request body")
        try:
            return deps.scheduler.update_schedule(body["schedule"])
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

        current = deps.scheduler.current_schedule.get(agent_name, {})
        update_entry = {
            "name": agent_name,
            "schedule": schedule_cron,
            "description": body.get("description", current.get("description", "")),
            "model": body.get("model", current.get("model", "sonnet")),
            "enabled": body.get("enabled", current.get("enabled", True)),
        }

        full_schedule = []
        for name, config in deps.scheduler.current_schedule.items():
            if name == agent_name:
                full_schedule.append(update_entry)
            else:
                full_schedule.append({"name": name, **config})

        try:
            return deps.scheduler.update_schedule(full_schedule)
        except Exception as e:
            raise HTTPException(400, f"Failed to update schedule: {str(e)}")

    @app.post("/schedule", dependencies=[Depends(require_auth)])
    async def reset_schedule(body: dict):
        """Reset schedule to default configuration."""
        if body.get("action") != "reset":
            raise HTTPException(400, "Invalid action. Use {\"action\": \"reset\"}")
        try:
            return deps.scheduler.reset_to_defaults()
        except Exception as e:
            raise HTTPException(400, f"Failed to reset schedule: {str(e)}")

    # ----- Read-Only Mode -----

    @app.post("/readonly/enable", dependencies=[Depends(require_auth)])
    async def enable_readonly_mode():
        from podclaw.hooks.security_hook import enable_readonly
        enable_readonly()
        return {"status": "enabled", "readonly": True}

    @app.post("/readonly/disable", dependencies=[Depends(require_auth)])
    async def disable_readonly_mode():
        from podclaw.hooks.security_hook import disable_readonly
        disable_readonly()
        return {"status": "disabled", "readonly": False}

    @app.get("/readonly", dependencies=[Depends(require_auth)])
    async def get_readonly_status():
        from podclaw.hooks.security_hook import is_readonly
        return {"readonly": is_readonly()}
