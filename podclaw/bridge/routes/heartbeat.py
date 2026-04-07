# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Heartbeat runner endpoints: status, trigger, pause, resume, alerts."""

from __future__ import annotations

import asyncio

from fastapi import Depends, FastAPI, HTTPException, Query

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register heartbeat endpoints."""

    @app.get("/heartbeat/status", dependencies=[Depends(require_auth)])
    async def get_heartbeat_status():
        """Get heartbeat runner status."""
        if not deps.heartbeat:
            return {"running": False, "message": "Heartbeat not initialized"}
        return deps.heartbeat.get_status()

    @app.post("/heartbeat/trigger", dependencies=[Depends(require_auth)])
    async def trigger_heartbeat():
        """Trigger a manual heartbeat cycle."""
        if not deps.heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        result = await deps.heartbeat.run_once()
        return result

    @app.post("/heartbeat/pause", dependencies=[Depends(require_auth)])
    async def pause_heartbeat():
        """Pause the heartbeat runner."""
        if not deps.heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        deps.heartbeat.pause()
        return {"status": "paused"}

    @app.post("/heartbeat/resume", dependencies=[Depends(require_auth)])
    async def resume_heartbeat():
        """Resume the heartbeat runner."""
        if not deps.heartbeat:
            raise HTTPException(503, "Heartbeat not initialized")
        deps.heartbeat.resume()
        return {"status": "resumed"}

    @app.get("/heartbeat/alerts", dependencies=[Depends(require_auth)])
    async def get_heartbeat_alerts(
        limit: int = Query(default=20, le=100),
    ):
        """Query recent heartbeat alerts from heartbeat_events table."""
        if not deps.event_store._client:
            return {"alerts": [], "count": 0}

        try:
            result = await asyncio.to_thread(
                lambda: (
                    deps.event_store._client.table("heartbeat_events")
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
