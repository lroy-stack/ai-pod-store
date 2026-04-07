# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Event queue endpoints: peek, push, dead-letter queue."""

from __future__ import annotations

import json as _json
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState
from podclaw.bridge.models import QueuePushRequest


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register event queue endpoints."""

    @app.get("/queue", dependencies=[Depends(require_auth)])
    async def peek_queue():
        """Peek at the system event queue without draining."""
        if not deps.event_queue:
            return {"events": [], "size": 0}
        events = await deps.event_queue.peek()
        return {
            "events": [e.to_dict() for e in events],
            "size": deps.event_queue.size,
        }

    @app.post("/queue/push", dependencies=[Depends(require_auth)])
    async def push_queue_event(body: QueuePushRequest):
        """Push a manual event to the system event queue."""
        if not deps.event_queue:
            raise HTTPException(503, "Event queue not initialized")

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
        added = await deps.event_queue.push(event)
        return {"status": "ok", "added": added, "queue_size": deps.event_queue.size}

    @app.get("/queue/dlq", dependencies=[Depends(require_auth)])
    async def peek_dead_letter_queue():
        """Peek at failed events in the dead-letter queue (Redis LIST)."""
        if not deps.event_queue:
            return {"events": [], "size": 0}
        dlq_events = await deps.event_queue.peek_dlq()
        return {
            "events": dlq_events,
            "size": len(dlq_events),
            "redis_key": "podclaw:events:dlq",
        }
