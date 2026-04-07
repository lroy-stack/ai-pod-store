"""
PodClaw — SVG Renderer MCP Connector
=======================================

2 tools: render SVG to PNG and composite multiple layers.
Talks to the Node.js sidecar (resvg + sharp) on port 3002.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import _err

logger = structlog.get_logger(__name__)

_TIMEOUT = 60.0  # SVG rendering can be slow for large designs
_MAX_SVG_SIZE = 50 * 1024  # 50KB max SVG input
_MAX_CONCURRENT = 2


class SVGRendererConnector:
    """Connector to the Node.js SVG renderer sidecar (resvg + sharp)."""

    def __init__(self, base_url: str = "http://svg-renderer:3002"):
        self._base_url = base_url.rstrip("/")
        self._semaphore = asyncio.Semaphore(_MAX_CONCURRENT)

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "svg_render_png": {
                "description": (
                    "Render an SVG string to a print-ready PNG at exact "
                    "pixel dimensions and DPI. Returns base64 PNG."
                ),
                "input_schema": {
                    "type": "object",
                    "required": ["svg", "width", "height"],
                    "properties": {
                        "svg": {
                            "type": "string",
                            "description": "SVG markup to render (max 50KB)",
                        },
                        "width": {
                            "type": "integer",
                            "description": "Target width in pixels",
                        },
                        "height": {
                            "type": "integer",
                            "description": "Target height in pixels",
                        },
                        "dpi": {
                            "type": "integer",
                            "description": "Output DPI (default 300)",
                            "default": 300,
                        },
                        "background": {
                            "type": "string",
                            "enum": ["transparent", "white", "black"],
                            "description": "Background color (default transparent)",
                            "default": "transparent",
                        },
                    },
                },
                "handler": self._render,
            },
            "svg_composite_layers": {
                "description": (
                    "Composite multiple layers (SVG or PNG) into a single "
                    "print-ready PNG. Useful for multi-placement designs."
                ),
                "input_schema": {
                    "type": "object",
                    "required": ["layers", "width", "height"],
                    "properties": {
                        "layers": {
                            "type": "array",
                            "description": "Ordered layers (bottom to top)",
                            "items": {
                                "type": "object",
                                "required": ["type", "content"],
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": ["svg", "png_base64"],
                                    },
                                    "content": {"type": "string"},
                                    "x": {"type": "integer", "default": 0},
                                    "y": {"type": "integer", "default": 0},
                                    "width": {"type": "integer"},
                                    "height": {"type": "integer"},
                                },
                            },
                        },
                        "width": {
                            "type": "integer",
                            "description": "Canvas width in pixels",
                        },
                        "height": {
                            "type": "integer",
                            "description": "Canvas height in pixels",
                        },
                        "dpi": {
                            "type": "integer",
                            "description": "Output DPI (default 300)",
                            "default": 300,
                        },
                    },
                },
                "handler": self._composite,
            },
        }

    async def _render(self, params: dict[str, Any]) -> dict[str, Any]:
        svg = params["svg"]
        if len(svg.encode()) > _MAX_SVG_SIZE:
            return _err(f"SVG too large: {len(svg.encode())} bytes (max {_MAX_SVG_SIZE})")

        payload = {
            "svg": svg,
            "width": params["width"],
            "height": params["height"],
            "dpi": params.get("dpi", 300),
            "background": params.get("background", "transparent"),
        }
        try:
            async with self._semaphore:
                async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                    resp = await client.post(f"{self._base_url}/render", json=payload)
                    resp.raise_for_status()

            png_b64 = base64.b64encode(resp.content).decode()
            return {
                "success": True,
                "png_base64": png_b64,
                "width": params["width"],
                "height": params["height"],
                "dpi": params.get("dpi", 300),
                "size_bytes": len(resp.content),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("svg_render_failed", status=exc.response.status_code, detail=exc.response.text[:200])
            return _err(f"HTTP {exc.response.status_code}: {exc.response.text[:200]}")
        except Exception as exc:
            logger.error("svg_render_error", error=str(exc))
            return _err(str(exc))

    async def _composite(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "layers": params["layers"],
            "width": params["width"],
            "height": params["height"],
            "dpi": params.get("dpi", 300),
        }
        try:
            async with self._semaphore:
                async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                    resp = await client.post(f"{self._base_url}/composite", json=payload)
                    resp.raise_for_status()

            png_b64 = base64.b64encode(resp.content).decode()
            return {
                "success": True,
                "png_base64": png_b64,
                "width": params["width"],
                "height": params["height"],
                "dpi": params.get("dpi", 300),
                "size_bytes": len(resp.content),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("svg_composite_failed", status=exc.response.status_code, detail=exc.response.text[:200])
            return _err(f"HTTP {exc.response.status_code}: {exc.response.text[:200]}")
        except Exception as exc:
            logger.error("svg_composite_error", error=str(exc))
            return _err(str(exc))
