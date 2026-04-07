# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Route modules for the PodClaw Bridge API."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI
    from podclaw.bridge.deps import BridgeDeps, BridgeState


def register_all(app: "FastAPI", deps: "BridgeDeps", state: "BridgeState") -> None:
    """Register all route modules on the FastAPI app."""
    from podclaw.bridge.routes import (
        system,
        agents,
        tasks,
        memory,
        heartbeat,
        queue,
        chat,
        webhooks,
        pipelines,
    )

    for module in (
        system,
        agents,
        tasks,
        memory,
        heartbeat,
        queue,
        chat,
        webhooks,
        pipelines,
    ):
        module.register(app, deps, state)
