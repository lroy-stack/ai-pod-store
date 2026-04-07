# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Bridge dependency containers and shared state."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import structlog

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


class TaskStore:
    """Dict-like wrapper over StateStore for task persistence."""

    def __init__(self, store: "StateStore | None" = None):
        self._store = store
        self._local: dict[str, dict[str, Any]] = {}

    def __contains__(self, key: str) -> bool:
        return key in self._local

    def __getitem__(self, key: str) -> dict[str, Any]:
        return self._local[key]

    def __setitem__(self, key: str, value: dict[str, Any]) -> None:
        self._local[key] = value
        if self._store:
            asyncio.create_task(self._store.set("task_store", self._local))

    def values(self):
        return self._local.values()

    def __len__(self) -> int:
        return len(self._local)

    async def restore(self) -> None:
        if self._store:
            data = await self._store.get("task_store", {})
            if data:
                self._local.update(data)
                logger.info("task_store_restored", count=len(data))


@dataclass(frozen=True)
class BridgeDeps:
    """Immutable container for all bridge dependencies."""

    orchestrator: "Orchestrator"
    scheduler: "PodClawScheduler"
    event_store: "EventStore"
    memory_manager: "MemoryManager"
    heartbeat: "HeartbeatRunner | None" = None
    event_queue: "SystemEventQueue | None" = None
    soul_evolution: "SoulEvolution | None" = None
    state_store: "StateStore | None" = None
    connectors: dict[str, Any] | None = None
    delegation_registry: Any | None = None
    event_dispatcher: Any | None = None


@dataclass
class BridgeState:
    """Mutable runtime state shared across route modules."""

    tasks: TaskStore
    connectors: dict[str, Any] = field(default_factory=dict)
    chat_mcp_servers: dict[str, Any] = field(default_factory=dict)
    memory_store: Any | None = None
