# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Pydantic request models for the Bridge API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TaskRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    tenant_id: str | None = Field(default=None, description="Tenant UUID for multi-tenant isolation")


class AgentRunRequest(BaseModel):
    task: str | None = None


class ChatStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_id: str | None = None


class QueuePushRequest(BaseModel):
    source: str = Field(default="admin", max_length=50)
    event_type: str = Field(default="message", max_length=50)
    payload: dict = Field(default_factory=dict)
    wake_mode: str = Field(default="next-heartbeat", pattern=r"^(now|next-heartbeat)$")
    target_agent: str | None = Field(default=None, max_length=50)
