"""
PodClaw — Gemini MCP Connector
=================================

Text embeddings via Google AI Studio (free tier).
Used by cataloger and newsletter for RAG and personalization.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"


class GeminiMCPConnector:
    """In-process MCP connector for Google Gemini embeddings."""

    def __init__(self, api_key: str):
        self._key = api_key

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "gemini_embed_text": {
                "description": "Generate a 768-dim embedding for a text string",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to embed"},
                        "task_type": {
                            "type": "string",
                            "enum": ["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY", "SEMANTIC_SIMILARITY"],
                        },
                    },
                    "required": ["text"],
                },
                "handler": self._embed_text,
            },
            "gemini_embed_batch": {
                "description": "Generate embeddings for multiple texts in batch",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "texts": {"type": "array", "items": {"type": "string"}},
                        "task_type": {"type": "string"},
                    },
                    "required": ["texts"],
                },
                "handler": self._embed_batch,
            },
        }

    async def _embed_text(self, params: dict[str, Any]) -> dict[str, Any]:
        model = "models/gemini-embedding-001"
        url = f"{GEMINI_API}/{model}:embedContent?key={self._key}"
        body = {
            "model": model,
            "content": {"parts": [{"text": params["text"]}]},
        }
        if params.get("task_type"):
            body["taskType"] = params["task_type"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            return {"embedding": data.get("embedding", {}).get("values", [])}

    async def _embed_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        model = "models/gemini-embedding-001"
        url = f"{GEMINI_API}/{model}:batchEmbedContents?key={self._key}"
        requests = [
            {
                "model": model,
                "content": {"parts": [{"text": t}]},
                **({"taskType": params["task_type"]} if params.get("task_type") else {}),
            }
            for t in params["texts"]
        ]
        body = {"requests": requests}

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            embeddings = [e.get("values", []) for e in data.get("embeddings", [])]
            return {"embeddings": embeddings, "count": len(embeddings)}
