# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Memory and soul evolution endpoints."""

from __future__ import annotations

import re

from fastapi import Depends, FastAPI, HTTPException

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register memory and soul endpoints."""

    # ----- Memory -----

    @app.get("/memory", dependencies=[Depends(require_auth)])
    async def get_memory():
        """Aggregated memory view: MEMORY.md + daily log + context file list."""
        long_term = deps.memory_manager.read_memory()
        soul = deps.memory_manager.read_soul()

        daily_path = deps.memory_manager._daily_log_path()
        daily = daily_path.read_text() if daily_path.exists() else ""

        context_dir = deps.memory_manager.context_dir
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
        path = deps.memory_manager._daily_log_path()
        if path.exists():
            return {"content": path.read_text(), "date": path.stem}
        return {"content": "", "date": path.stem}

    @app.get("/memory/context/{filename}", dependencies=[Depends(require_auth)])
    async def get_context_file(filename: str):
        if not re.match(r'^[a-zA-Z0-9._-]+$', filename):
            raise HTTPException(400, "Invalid filename: only alphanumeric, dots, hyphens, and underscores are allowed")
        try:
            content = deps.memory_manager.read_context(filename)
        except ValueError as e:
            raise HTTPException(400, str(e))
        if not content:
            raise HTTPException(404, f"Context file not found: {filename}")
        return {"content": content, "filename": filename}

    @app.get("/memory/soul", dependencies=[Depends(require_auth)])
    async def get_soul_legacy():
        return {"content": deps.memory_manager.read_soul()}

    @app.post("/memory/consolidate", dependencies=[Depends(require_auth)])
    async def run_consolidation():
        """Trigger memory consolidation cycle manually."""
        await deps.orchestrator.run_consolidation()
        return {"status": "ok", "message": "Memory consolidation completed"}

    # ----- Memory: HEARTBEAT.md -----

    @app.get("/memory/heartbeat", dependencies=[Depends(require_auth)])
    async def get_heartbeat_md():
        """Read the HEARTBEAT.md checklist."""
        return {"content": deps.memory_manager.read_heartbeat()}

    @app.put("/memory/heartbeat", dependencies=[Depends(require_auth)])
    async def update_heartbeat_md(body: dict):
        """Update the HEARTBEAT.md checklist."""
        content = body.get("content")
        if content is None:
            raise HTTPException(400, "Missing 'content' field")
        await deps.memory_manager.update_heartbeat(content)
        return {"status": "ok"}

    # ----- Soul Evolution -----

    @app.get("/soul", dependencies=[Depends(require_auth)])
    async def get_soul():
        """Read the full SOUL.md content."""
        return {"content": deps.memory_manager.read_soul()}

    @app.get("/soul/proposals", dependencies=[Depends(require_auth)])
    async def get_soul_proposals():
        """List pending soul evolution proposals."""
        if not deps.soul_evolution:
            return {"proposals": [], "count": 0}
        proposals = deps.soul_evolution.get_pending_proposals()
        return {"proposals": proposals, "count": len(proposals)}

    @app.post("/soul/proposals/{proposal_id}/approve", dependencies=[Depends(require_auth)])
    async def approve_soul_proposal(proposal_id: str):
        """Approve and apply a pending soul proposal."""
        if not deps.soul_evolution:
            raise HTTPException(503, "Soul evolution not initialized")
        success = await deps.soul_evolution.apply_proposal(proposal_id)
        if not success:
            raise HTTPException(404, f"Proposal not found: {proposal_id}")
        return {"status": "approved", "proposal_id": proposal_id}

    @app.post("/soul/proposals/{proposal_id}/reject", dependencies=[Depends(require_auth)])
    async def reject_soul_proposal(proposal_id: str, body: dict | None = None):
        """Reject a pending soul proposal."""
        if not deps.soul_evolution:
            raise HTTPException(503, "Soul evolution not initialized")
        reason = (body or {}).get("reason", "")
        success = await deps.soul_evolution.reject_proposal(proposal_id, reason)
        if not success:
            raise HTTPException(404, f"Proposal not found: {proposal_id}")
        return {"status": "rejected", "proposal_id": proposal_id}
