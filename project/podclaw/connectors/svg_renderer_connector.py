"""SVG Renderer Sidecar — MCP connector for SVG→PNG rendering."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 60.0  # SVG rendering can be slow for large designs


class SVGRendererConnector:
    """Connector to the Node.js SVG renderer sidecar (resvg + sharp)."""

    def __init__(self, base_url: str = "http://svg-renderer:3002"):
        self._base_url = base_url.rstrip("/")

    # ── Tools ────────────────────────────────────────────────

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "svg_render_png": {
                "description": (
                    "Render an SVG string to a print-ready PNG at exact "
                    "pixel dimensions and DPI. Returns raw PNG bytes."
                ),
                "parameters": {
                    "type": "object",
                    "required": ["svg", "width", "height"],
                    "properties": {
                        "svg": {
                            "type": "string",
                            "description": "SVG markup to render",
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
            "svg_composite": {
                "description": (
                    "Composite multiple layers (SVG or PNG) into a single "
                    "print-ready PNG. Useful for multi-placement designs."
                ),
                "parameters": {
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

    # ── Handlers ─────────────────────────────────────────────

    async def _render(self, params: dict[str, Any]) -> dict[str, Any]:
        """Call POST /render on the sidecar."""
        payload = {
            "svg": params["svg"],
            "width": params["width"],
            "height": params["height"],
            "dpi": params.get("dpi", 300),
            "background": params.get("background", "transparent"),
        }
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{self._base_url}/render", json=payload
                )
                resp.raise_for_status()

            import base64

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
            logger.error("SVG render failed: %s %s", exc.response.status_code, exc.response.text[:200])
            return {"success": False, "error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"}
        except Exception as exc:
            logger.error("SVG render error: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _composite(self, params: dict[str, Any]) -> dict[str, Any]:
        """Call POST /composite on the sidecar."""
        payload = {
            "layers": params["layers"],
            "width": params["width"],
            "height": params["height"],
            "dpi": params.get("dpi", 300),
        }
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{self._base_url}/composite", json=payload
                )
                resp.raise_for_status()

            import base64

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
            logger.error("SVG composite failed: %s %s", exc.response.status_code, exc.response.text[:200])
            return {"success": False, "error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"}
        except Exception as exc:
            logger.error("SVG composite error: %s", exc)
            return {"success": False, "error": str(exc)}
