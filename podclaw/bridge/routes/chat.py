# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""Chat endpoints: SSE streaming, conversation CRUD."""

from __future__ import annotations

import uuid

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse

from podclaw.bridge.auth import require_auth
from podclaw.bridge.deps import BridgeDeps, BridgeState
from podclaw.bridge.models import ChatStreamRequest


def register(app: FastAPI, deps: BridgeDeps, state: BridgeState) -> None:
    """Register chat endpoints."""

    @app.post("/chat/stream", dependencies=[Depends(require_auth)])
    async def chat_stream(body: ChatStreamRequest):
        """SSE streaming chat with PodClaw."""
        from podclaw.chat_session import ChatSession
        from podclaw.connectors.delegate_connector import DelegateMCPConnector
        from podclaw.connector_adapter import connector_to_mcp_server

        conversation_id = body.conversation_id or str(uuid.uuid4())

        chat_mcp = dict(state.chat_mcp_servers)

        delegate_conn = DelegateMCPConnector(
            deps.orchestrator,
            delegation_registry=deps.delegation_registry,
            conversation_id=conversation_id,
        )
        chat_mcp["delegate"] = connector_to_mcp_server("delegate", delegate_conn)

        chat_connectors = dict(state.connectors)
        chat_connectors["delegate"] = delegate_conn

        session = ChatSession(
            conversation_id=conversation_id,
            mcp_servers=chat_mcp,
            memory_manager=deps.memory_manager,
            event_store=deps.event_store,
            hooks={
                "pre_tool_use": list(deps.orchestrator.factory.hooks.get("pre_tool_use", [])),
                "post_tool_use": list(deps.orchestrator.factory.hooks.get("post_tool_use", [])),
            },
            connectors=chat_connectors,
            state_store=deps.state_store,
            memory_store=state.memory_store,
            delegation_registry=deps.delegation_registry,
        )

        return StreamingResponse(
            session.stream_response(body.message),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/chat/conversations", dependencies=[Depends(require_auth)])
    async def get_chat_conversations(limit: int = Query(default=50, le=100)):
        """List recent admin chat conversations."""
        from podclaw.chat_session import list_conversations
        conversations = await list_conversations(deps.event_store, limit=limit)
        return {"conversations": conversations, "count": len(conversations)}

    @app.get("/chat/conversations/{conversation_id}", dependencies=[Depends(require_auth)])
    async def get_chat_conversation(conversation_id: str):
        """Get a conversation with its messages."""
        from podclaw.chat_session import get_conversation
        conv = await get_conversation(deps.event_store, conversation_id)
        if not conv:
            raise HTTPException(404, f"Conversation not found: {conversation_id}")
        return conv

    @app.delete("/chat/conversations/{conversation_id}", dependencies=[Depends(require_auth)])
    async def delete_chat_conversation(conversation_id: str):
        """Delete a conversation and its messages."""
        from podclaw.chat_session import delete_conversation
        success = await delete_conversation(deps.event_store, conversation_id)
        if not success:
            raise HTTPException(500, "Failed to delete conversation")
        return {"status": "deleted", "conversation_id": conversation_id}
