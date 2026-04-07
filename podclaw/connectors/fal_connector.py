"""
PodClaw — fal.ai MCP Connector
=================================

AI image generation via FLUX.1 model + background removal + upscaling for the designer agent.
"""

from __future__ import annotations

import io
import os
import uuid
from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import CircuitBreaker, _err

logger = structlog.get_logger(__name__)

FAL_API = "https://queue.fal.run"
FAL_SYNC_API = "https://fal.run"

_MODEL_ENDPOINTS = {
    # FLUX — artistic illustrations, patterns, abstract designs
    "schnell": "fal-ai/flux/schnell",           # $0.003 draft preview
    "flux-pro": "fal-ai/flux-pro/v1.1",         # $0.04  production art
    # GPT Image — realism, text in images, portraits, photography
    "gpt-image-mini": "fal-ai/gpt-image-1-mini",  # $0.011 draft with text
    "gpt-image-1.5": "fal-ai/gpt-image-1.5",      # $0.034 premium realism
}

# GPT Image models use different params than FLUX
_GPT_MODELS = frozenset({"gpt-image-mini", "gpt-image-1.5"})

_DEFAULT_MODEL = "flux-pro"


class FalMCPConnector:
    """In-process MCP connector for fal.ai."""

    def __init__(self, api_key: str):
        self._key = api_key
        self._headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        }
        self._circuit_breaker = CircuitBreaker(name="fal", failure_threshold=5, timeout=60.0)

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "fal_generate_image": {
                "description": (
                    "PAID — generate an image via fal.ai. Choose model by use case: "
                    "flux-pro ($0.04) for artistic illustrations/patterns, "
                    "gpt-image-1.5 ($0.034) for realism/text/portraits, "
                    "gpt-image-mini ($0.011) for drafts with text, "
                    "schnell ($0.003) for quick previews. "
                    "GPT Image models support native transparent backgrounds."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "Image generation prompt"},
                        "image_size": {
                            "type": "string",
                            "description": "FLUX: square_hd/landscape_4_3/portrait_hd. GPT: 1024x1024/1536x1024/1024x1536",
                        },
                        "num_images": {"type": "integer", "description": "Number of images (1-4)"},
                        "seed": {"type": "integer", "description": "Random seed (FLUX only)"},
                        "model": {
                            "type": "string",
                            "enum": ["flux-pro", "gpt-image-1.5", "gpt-image-mini", "schnell"],
                            "description": (
                                "flux-pro ($0.04, art/illustrations), "
                                "gpt-image-1.5 ($0.034, realism/text/portraits), "
                                "gpt-image-mini ($0.011, drafts with text), "
                                "schnell ($0.003, quick preview)"
                            ),
                            "default": "flux-pro",
                        },
                        "quality": {
                            "type": "string",
                            "enum": ["low", "medium", "high"],
                            "description": "Quality level (GPT Image models only, default: medium)",
                        },
                        "background": {
                            "type": "string",
                            "enum": ["auto", "transparent", "opaque"],
                            "description": "Background mode (GPT Image models only — 'transparent' for POD designs)",
                        },
                    },
                    "required": ["prompt"],
                },
                "handler": self._generate,
            },
            "fal_get_generation_status": {
                "description": "Check status of a fal.ai generation request",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "request_id": {"type": "string"},
                        "model": {
                            "type": "string",
                            "enum": ["schnell", "dev", "flux-pro"],
                            "description": "Model used for the original request (defaults to dev)",
                            "default": "flux-pro",
                        },
                    },
                    "required": ["request_id"],
                },
                "handler": self._get_status,
            },
            "fal_remove_background": {
                "description": (
                    "Remove background from an image. "
                    "Uses local rembg sidecar ($0) if available, falls back to fal.ai cloud. "
                    "Returns a URL to the transparent-background image. "
                    "Required for sourced images before Printful upload."
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
            "fal_upscale_image": {
                "description": (
                    "Upscale an image using Real-ESRGAN (4x or 2x). "
                    "Cost: ~$0.003/image. Preserves alpha channel for transparent PNGs. "
                    "Use after bg removal to reach print-quality resolution (e.g. 4500px for t-shirts)."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "image_url": {
                            "type": "string",
                            "description": "Public HTTPS URL of the image to upscale",
                        },
                        "scale": {
                            "type": "integer",
                            "enum": [2, 4],
                            "description": "Upscale factor (2x or 4x). Default 4.",
                            "default": 4,
                        },
                    },
                    "required": ["image_url"],
                },
                "handler": self._upscale,
            },
        }

    async def _generate(self, params: dict[str, Any]) -> dict[str, Any]:
        model = params.get("model", _DEFAULT_MODEL)
        endpoint = _MODEL_ENDPOINTS.get(model, _MODEL_ENDPOINTS[_DEFAULT_MODEL])
        url = f"{FAL_API}/{endpoint}"

        # Build request body — different params for FLUX vs GPT Image
        if model in _GPT_MODELS:
            body = {
                "prompt": params["prompt"],
                "image_size": params.get("image_size", "1024x1024"),
                "quality": params.get("quality", "medium"),
                "background": params.get("background", "transparent"),
                "output_format": "png",
                "num_images": min(params.get("num_images", 1), 4),
            }
        else:
            # FLUX models
            if params.get("width") and params.get("height"):
                image_size = {"width": params["width"], "height": params["height"]}
            else:
                image_size = params.get("image_size", "square_hd")
            body = {
                "prompt": params["prompt"],
                "image_size": image_size,
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
        model = params.get("model", _DEFAULT_MODEL)
        endpoint = _MODEL_ENDPOINTS.get(model, _MODEL_ENDPOINTS[_DEFAULT_MODEL])
        url = f"{FAL_API}/{endpoint}/requests/{request_id}/status"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def _call_fal_sync(self, endpoint: str, body: dict) -> dict[str, Any]:
        """Call a fal.ai sync endpoint and return the JSON response."""
        url = f"{FAL_SYNC_API}/{endpoint}"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()

    async def _upscale(self, params: dict[str, Any]) -> dict[str, Any]:
        """Upscale image with Real-ESRGAN. Preserves alpha channel for PNGs."""
        from podclaw.bg_removal import upload_to_storage
        from podclaw.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

        image_url = params["image_url"]
        scale = params.get("scale", 4)

        try:
            # Download image to check for alpha channel
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                image_bytes = resp.content

            from PIL import Image

            img = Image.open(io.BytesIO(image_bytes))
            has_alpha = img.mode == "RGBA"
            orig_w, orig_h = img.size

            if has_alpha:
                # Split channels: upscale RGB with ESRGAN, alpha with PIL bicubic
                rgb = img.convert("RGB")
                alpha = img.getchannel("A")

                # Save RGB to buffer and upload temporarily
                rgb_buf = io.BytesIO()
                rgb.save(rgb_buf, format="PNG")
                rgb_bytes = rgb_buf.getvalue()

                if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
                    return {"error": "Supabase credentials required for upscale with alpha"}

                temp_url = await upload_to_storage(
                    SUPABASE_URL, SUPABASE_SERVICE_KEY,
                    source_bytes=rgb_bytes,
                )
                if not temp_url:
                    return {"error": "Failed to upload temp RGB for upscale"}

                # ESRGAN on RGB
                result = await self._call_fal_sync(
                    "fal-ai/esrgan", {"image_url": temp_url, "scale": scale}
                )
                upscaled_rgb_url = result.get("image", {}).get("url") or result.get("image_url")
                if not upscaled_rgb_url:
                    return {"error": "ESRGAN returned no image URL", "raw": result}

                # Download upscaled RGB
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(upscaled_rgb_url)
                    resp.raise_for_status()
                    upscaled_rgb = Image.open(io.BytesIO(resp.content)).convert("RGB")

                # Upscale alpha with PIL bicubic
                new_w, new_h = upscaled_rgb.size
                upscaled_alpha = alpha.resize((new_w, new_h), Image.BICUBIC)

                # Recombine RGBA
                r, g, b = upscaled_rgb.split()
                final = Image.merge("RGBA", (r, g, b, upscaled_alpha))

                final_buf = io.BytesIO()
                final.save(final_buf, format="PNG")
                final_bytes = final_buf.getvalue()

                # Upload final to Storage
                public_url = await upload_to_storage(
                    SUPABASE_URL, SUPABASE_SERVICE_KEY,
                    source_bytes=final_bytes,
                )
                if not public_url:
                    return {"error": "Failed to upload upscaled RGBA image"}

                logger.info(
                    "fal_upscale_ok",
                    has_alpha=True,
                    scale=scale,
                    original=f"{orig_w}x{orig_h}",
                    result=f"{new_w}x{new_h}",
                )
                return {
                    "image_url": public_url,
                    "width": new_w,
                    "height": new_h,
                    "scale": scale,
                    "has_alpha": True,
                    "cost_usd": 0.003,
                }
            else:
                # No alpha — straightforward ESRGAN
                result = await self._call_fal_sync(
                    "fal-ai/esrgan", {"image_url": image_url, "scale": scale}
                )
                upscaled_url = result.get("image", {}).get("url") or result.get("image_url")
                if not upscaled_url:
                    return {"error": "ESRGAN returned no image URL", "raw": result}

                # Persist to Storage
                if SUPABASE_URL and SUPABASE_SERVICE_KEY:
                    public_url = await upload_to_storage(
                        SUPABASE_URL, SUPABASE_SERVICE_KEY,
                        source_url=upscaled_url,
                    )
                    if public_url:
                        upscaled_url = public_url

                new_w = orig_w * scale
                new_h = orig_h * scale
                logger.info(
                    "fal_upscale_ok",
                    has_alpha=False,
                    scale=scale,
                    original=f"{orig_w}x{orig_h}",
                    result=f"{new_w}x{new_h}",
                )
                return {
                    "image_url": upscaled_url,
                    "width": new_w,
                    "height": new_h,
                    "scale": scale,
                    "has_alpha": False,
                    "cost_usd": 0.003,
                }

        except httpx.HTTPStatusError as e:
            logger.error("fal_upscale_http_error", status=e.response.status_code, detail=e.response.text[:200])
            return {"error": f"Upscale HTTP error ({e.response.status_code}): {e.response.text[:200]}"}
        except Exception as e:
            logger.error("fal_upscale_exception", error=str(e))
            return {"error": f"Upscale error: {e}"}

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
