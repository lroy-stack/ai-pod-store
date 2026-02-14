"""
PodClaw — fal.ai MCP Connector
=================================

AI image generation via FLUX.1 model for the designer agent.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

FAL_API = "https://queue.fal.run"


class FalMCPConnector:
    """In-process MCP connector for fal.ai."""

    def __init__(self, api_key: str):
        self._key = api_key
        self._headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        }

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "fal_generate": {
                "description": "Generate an image using fal.ai FLUX.1 model",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "Image generation prompt"},
                        "image_size": {"type": "string", "enum": ["square_hd", "landscape_4_3", "portrait_hd"]},
                        "num_images": {"type": "integer", "description": "Number of images (1-4)"},
                        "seed": {"type": "integer", "description": "Random seed for reproducibility"},
                    },
                    "required": ["prompt"],
                },
                "handler": self._generate,
            },
            "fal_get_status": {
                "description": "Check status of a fal.ai generation request",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "request_id": {"type": "string"},
                    },
                    "required": ["request_id"],
                },
                "handler": self._get_status,
            },
        }

    async def _generate(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{FAL_API}/fal-ai/flux/dev"
        body = {
            "prompt": params["prompt"],
            "image_size": params.get("image_size", "square_hd"),
            "num_images": min(params.get("num_images", 1), 4),
        }
        if params.get("seed"):
            body["seed"] = params["seed"]

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()

    async def _get_status(self, params: dict[str, Any]) -> dict[str, Any]:
        request_id = params["request_id"]
        url = f"{FAL_API}/fal-ai/flux/dev/requests/{request_id}/status"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()
