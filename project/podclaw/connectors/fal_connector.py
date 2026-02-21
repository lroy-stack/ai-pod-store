"""
PodClaw — fal.ai MCP Connector
=================================

AI image generation via FLUX.1 model + background removal for the designer agent.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

FAL_API = "https://queue.fal.run"
FAL_SYNC_API = "https://fal.run"

_MODEL_ENDPOINTS = {
    "schnell": "fal-ai/flux/schnell",
    "dev": "fal-ai/flux/dev",
    "flux-pro": "fal-ai/flux-pro/v1.1",
}


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
                "description": (
                    "PAID — use only after exhausting free sourced images (search_images). "
                    "Generate an image using fal.ai FLUX.1 model. "
                    "Cost: $0.003-$0.05 per image depending on model."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "Image generation prompt"},
                        "image_size": {"type": "string", "enum": ["square_hd", "landscape_4_3", "portrait_hd"]},
                        "num_images": {"type": "integer", "description": "Number of images (1-4)"},
                        "seed": {"type": "integer", "description": "Random seed for reproducibility"},
                        "model": {
                            "type": "string",
                            "enum": ["schnell", "dev", "flux-pro"],
                            "description": "FLUX model: schnell (fast draft $0.003), dev (balanced $0.025), flux-pro (best quality $0.05)",
                            "default": "dev",
                        },
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
                        "model": {
                            "type": "string",
                            "enum": ["schnell", "dev", "flux-pro"],
                            "description": "Model used for the original request (defaults to dev)",
                            "default": "dev",
                        },
                    },
                    "required": ["request_id"],
                },
                "handler": self._get_status,
            },
            "fal_remove_bg": {
                "description": (
                    "Remove background from an image. "
                    "Uses local rembg sidecar ($0) if available, falls back to fal.ai cloud. "
                    "Returns a URL to the transparent-background image. "
                    "Required for sourced images before Printify upload."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "image_url": {
                            "type": "string",
                            "description": "Public HTTPS URL of the image to process",
                        },
                    },
                    "required": ["image_url"],
                },
                "handler": self._remove_bg,
            },
        }

    async def _generate(self, params: dict[str, Any]) -> dict[str, Any]:
        model = params.get("model", "dev")
        endpoint = _MODEL_ENDPOINTS.get(model, _MODEL_ENDPOINTS["dev"])
        url = f"{FAL_API}/{endpoint}"
        body = {
            "prompt": params["prompt"],
            "image_size": params.get("image_size", "square_hd"),
            "num_images": min(params.get("num_images", 1), 4),
        }
        if params.get("seed"):
            body["seed"] = params["seed"]

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, headers=self._headers, json=body)

                if resp.status_code == 403:
                    logger.error("fal_generate_auth_failed", status=403, model=model)
                    return {
                        "error": "fal_auth_failed",
                        "status": 403,
                        "message": "FAL API key invalid or quota exhausted. Use gemini_generate_image as fallback.",
                    }

                if resp.status_code == 429:
                    retry_after = resp.headers.get("retry-after", "60")
                    logger.warning("fal_generate_rate_limited", status=429, retry_after=retry_after, model=model)
                    return {
                        "error": "fal_rate_limited",
                        "status": 429,
                        "message": f"FAL rate limited. Retry after {retry_after}s. Use gemini_generate_image as fallback.",
                        "retry_after": retry_after,
                    }

                if resp.status_code >= 400:
                    detail = resp.text[:300]
                    logger.error("fal_generate_failed", status=resp.status_code, detail=detail, model=model)
                    return {
                        "error": "fal_generate_failed",
                        "status": resp.status_code,
                        "message": f"FAL generation failed ({resp.status_code}): {detail}",
                    }

                return resp.json()

        except httpx.TimeoutException:
            logger.error("fal_generate_timeout", model=model, timeout=120)
            return {
                "error": "fal_timeout",
                "message": "FAL generation timed out after 120s. Use gemini_generate_image as fallback.",
            }
        except Exception as e:
            logger.error("fal_generate_exception", error=str(e), model=model)
            return {
                "error": "fal_exception",
                "message": f"FAL generation error: {e}. Use gemini_generate_image as fallback.",
            }

    async def _get_status(self, params: dict[str, Any]) -> dict[str, Any]:
        request_id = params["request_id"]
        model = params.get("model", "dev")
        endpoint = _MODEL_ENDPOINTS.get(model, _MODEL_ENDPOINTS["dev"])
        url = f"{FAL_API}/{endpoint}/requests/{request_id}/status"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _remove_bg(self, params: dict[str, Any]) -> dict[str, Any]:
        """Remove background using shared utility (local rembg → fal.ai fallback)."""
        from podclaw.bg_removal import call_local_rembg, call_fal_rembg, upload_to_storage
        from podclaw.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

        image_url = params["image_url"]

        # Priority 1: Local rembg sidecar ($0, always available)
        rembg_url = os.environ.get("REMBG_URL", "")
        if rembg_url:
            result = await call_local_rembg(rembg_url, image_url)
            if result.get("image_bytes"):
                if SUPABASE_URL and SUPABASE_SERVICE_KEY:
                    public_url = await upload_to_storage(
                        SUPABASE_URL, SUPABASE_SERVICE_KEY,
                        source_bytes=result["image_bytes"],
                    )
                    if public_url:
                        logger.info("fal_bg_removed", provider="local-rembg", url=public_url[:80])
                        return {"image_url": public_url, "provider": "local-rembg", "cost_usd": 0}
            logger.debug("local_rembg_failed", error=result.get("error"), fallback="fal-cloud")

        # Priority 2: fal.ai cloud (rembg free → bria $0.018)
        result = await call_fal_rembg(self._key, image_url)
        if result.get("image_url"):
            # Persist fal.ai ephemeral URL to Supabase Storage
            if SUPABASE_URL and SUPABASE_SERVICE_KEY:
                public_url = await upload_to_storage(
                    SUPABASE_URL, SUPABASE_SERVICE_KEY,
                    source_url=result["image_url"],
                )
                if public_url:
                    logger.info("fal_bg_removed", provider=result["provider"], url=public_url[:80])
                    return {"image_url": public_url, "provider": result["provider"], "cost_usd": result.get("cost_usd", 0)}
            # If Storage upload fails, return the ephemeral URL as-is
            logger.info("fal_bg_removed", provider=result["provider"], url=result["image_url"][:80])
            return result

        return {"error": "All background removal providers failed", "provider": "none", "cost_usd": 0}
