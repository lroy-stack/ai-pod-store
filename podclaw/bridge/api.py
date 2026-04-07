# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — FastAPI Bridge
==========================

HTTP API for the Next.js admin dashboard to control PodClaw.
Runs on port 8000. Next.js /api/agent/* routes proxy here.

See routes/ for endpoint implementations.
"""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import structlog

from podclaw.bridge.deps import BridgeDeps, BridgeState, TaskStore
from podclaw.bridge.routes import register_all

if TYPE_CHECKING:
    from podclaw.core import Orchestrator
    from podclaw.scheduler import PodClawScheduler
    from podclaw.event_store import EventStore
    from podclaw.memory_manager import MemoryManager
    from podclaw.heartbeat import HeartbeatRunner
    from podclaw.event_queue import SystemEventQueue
    from podclaw.soul_evolution import SoulEvolution
    from podclaw.state_store import StateStore

logger = structlog.get_logger(__name__)


def create_app(
    orchestrator: "Orchestrator",
    scheduler: "PodClawScheduler",
    event_store: "EventStore",
    memory_manager: "MemoryManager",
    heartbeat: "HeartbeatRunner | None" = None,
    event_queue: "SystemEventQueue | None" = None,
    soul_evolution: "SoulEvolution | None" = None,
    state_store: "StateStore | None" = None,
    connectors: dict[str, Any] | None = None,
    delegation_registry: Any | None = None,
    event_dispatcher: Any | None = None,
) -> FastAPI:
    """Create the FastAPI application with all routes."""

    app = FastAPI(
        title="PodClaw Bridge",
        description="Control API for PodClaw autonomous store manager",
        version="0.2.0",
    )

    from podclaw.config import CORS_ORIGINS
    cors_origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    # ----- Build deps & state -----

    deps = BridgeDeps(
        orchestrator=orchestrator,
        scheduler=scheduler,
        event_store=event_store,
        memory_manager=memory_manager,
        heartbeat=heartbeat,
        event_queue=event_queue,
        soul_evolution=soul_evolution,
        state_store=state_store,
        connectors=connectors,
        delegation_registry=delegation_registry,
        event_dispatcher=event_dispatcher,
    )

    _raw_connectors: dict[str, Any] = dict(connectors or {})

    # Extract memory_store from memory connector for chat session flush
    _memory_store = None
    _mem_conn = _raw_connectors.get("memory")
    if _mem_conn and hasattr(_mem_conn, "_store"):
        _memory_store = _mem_conn._store

    state = BridgeState(
        tasks=TaskStore(state_store),
        connectors=_raw_connectors,
        chat_mcp_servers={},
        memory_store=_memory_store,
    )

    # ----- Register all routes -----

    register_all(app, deps, state)

    # ----- Startup hooks -----

    @app.on_event("startup")
    async def _restore_tasks():
        """Restore persisted state on startup."""
        from podclaw.redis_store import get_redis

        await state.tasks.restore()

        redis_client = get_redis()
        if redis_client and event_queue:
            event_queue.set_redis(redis_client)
            logger.info("event_queue_redis_wired")

        if redis_client:
            try:
                paused_data = await redis_client.get("podclaw:state:paused_agents")
                if paused_data:
                    paused_agents = json.loads(paused_data)
                    for agent_name in paused_agents:
                        scheduler.pause_agent(agent_name)
                        logger.info("agent_restored_paused", agent=agent_name)
            except Exception as e:
                logger.warning("paused_agents_restore_failed", error=str(e))

        if redis_client and event_queue:
            try:
                events = await event_queue.peek()
                if events:
                    logger.info("event_queue_auto_restored", count=len(events))
            except Exception as e:
                logger.warning("event_queue_peek_failed", error=str(e))

    @app.on_event("startup")
    async def _build_chat_mcp():
        from podclaw.connector_adapter import connector_to_mcp_server
        from podclaw.config import AGENT_TOOLS
        all_connector_names = set()
        for tools in AGENT_TOOLS.values():
            all_connector_names.update(tools)
        for name in all_connector_names:
            conn = state.connectors.get(name)
            if conn:
                try:
                    state.chat_mcp_servers[name] = connector_to_mcp_server(name, conn)
                except Exception as e:
                    logger.warning("chat_mcp_build_failed", connector=name, error=str(e))

        memory_conn = state.connectors.get("memory")
        if memory_conn and "memory" not in state.chat_mcp_servers:
            try:
                state.chat_mcp_servers["memory"] = connector_to_mcp_server("memory", memory_conn)
            except Exception as e:
                logger.warning("memory_mcp_chat_failed", error=str(e))

    # ----- Shutdown hook -----

    @app.on_event("shutdown")
    async def _graceful_shutdown():
        """Graceful shutdown: drain tasks, persist state, close Redis."""
        from podclaw.redis_store import close_redis, get_redis

        logger.info("podclaw_shutdown_started")

        running_tasks = [t for t in state.tasks.values() if t.get("status") in ("routing", "running")]
        if running_tasks:
            logger.info("draining_tasks", count=len(running_tasks))
            timeout = 30
            start = asyncio.get_event_loop().time()

            while running_tasks and (asyncio.get_event_loop().time() - start) < timeout:
                await asyncio.sleep(1)
                running_tasks = [t for t in state.tasks.values() if t.get("status") in ("routing", "running")]

            if running_tasks:
                logger.warning("tasks_not_drained", count=len(running_tasks), timeout=timeout)
            else:
                logger.info("tasks_drained")

        redis_client = get_redis()
        if redis_client:
            try:
                paused_agents = []
                for job in scheduler.scheduler.get_jobs():
                    if job.next_run_time is None:
                        agent_name = job.id.replace("_scheduled", "").split("_")[0]
                        if agent_name not in paused_agents:
                            paused_agents.append(agent_name)

                if paused_agents:
                    await redis_client.set(
                        "podclaw:state:paused_agents",
                        json.dumps(paused_agents),
                        ex=604800,
                    )
                    logger.info("paused_agents_persisted", agents=paused_agents)
                else:
                    await redis_client.delete("podclaw:state:paused_agents")
                    logger.info("paused_agents_cleared")
            except Exception as e:
                logger.warning("paused_agents_persist_failed", error=str(e))

        if redis_client and event_queue:
            try:
                events = await event_queue.peek()
                logger.info("event_queue_shutdown_state", pending_count=len(events))
                await redis_client.delete("podclaw:state:event_queue")
            except Exception as e:
                logger.warning("event_queue_shutdown_check_failed", error=str(e))

        await close_redis()

        logger.info("podclaw_shutdown_complete")

    return app
