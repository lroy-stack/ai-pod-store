"""
PodClaw — Background Removal Utilities
=========================================

Shared functions for removing image backgrounds and persisting results
to Supabase Storage. Used by both transparency_hook (infrastructure) and
fal_connector (agent-callable tool).

Priority chain:
  1. Local rembg sidecar (REMBG_URL) — $0, ~200ms
  2. fal.ai rembg (cloud) — $0, may 403
  3. fal.ai bria/rmbg (cloud) — $0.018

Quality validation:
  After bg removal, validate_transparency() checks the alpha channel.
  If <15% transparent pixels → bg removal failed → auto-fallback to cloud.
  If <3% opaque pixels → too aggressive, subject was removed.
"""

from __future__ import annotations

import io
import uuid
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Thresholds for alpha channel validation
_MIN_TRANSPARENT_RATIO = 0.15  # At least 15% of pixels must be transparent
_MIN_OPAQUE_RATIO = 0.03       # At least 3% must be opaque (subject preserved)
_MAX_SEMI_TRANSPARENT_RATIO = 0.40  # >40% semi-transparent = messy edges

FAL_SYNC_API = "https://fal.run"


def validate_transparency(png_bytes: bytes) -> dict[str, Any]:
    """Validate that a bg-removed PNG has proper transparency.

    Analyzes the alpha channel to detect:
    - Failed removal: most pixels are still opaque (no transparency)
    - Over-aggressive removal: subject was eaten (almost all transparent)
    - Messy edges: too many semi-transparent pixels (halos/artifacts)

    Returns:
        {valid: bool, transparent_ratio: float, opaque_ratio: float,
         semi_ratio: float, reason: str}
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(png_bytes))

        # If no alpha channel, bg removal definitely failed
        if img.mode != "RGBA":
            return {
                "valid": False,
                "transparent_ratio": 0.0,
                "opaque_ratio": 1.0,
                "semi_ratio": 0.0,
                "reason": "no_alpha_channel",
            }

        alpha = img.getchannel("A")
        pixels = list(alpha.getdata())
        total = len(pixels)
        if total == 0:
            return {"valid": False, "transparent_ratio": 0, "opaque_ratio": 0,
                    "semi_ratio": 0, "reason": "empty_image"}

        transparent = sum(1 for p in pixels if p < 10)        # Nearly fully transparent
        opaque = sum(1 for p in pixels if p > 245)             # Nearly fully opaque
        semi = total - transparent - opaque                     # In-between (edges, artifacts)

        t_ratio = transparent / total
        o_ratio = opaque / total
        s_ratio = semi / total

        # Check: bg removal failed (barely any transparency)
        if t_ratio < _MIN_TRANSPARENT_RATIO:
            return {
                "valid": False,
                "transparent_ratio": round(t_ratio, 3),
                "opaque_ratio": round(o_ratio, 3),
                "semi_ratio": round(s_ratio, 3),
                "reason": "bg_not_removed",
            }

        # Check: too aggressive (subject removed)
        if o_ratio < _MIN_OPAQUE_RATIO:
            return {
                "valid": False,
                "transparent_ratio": round(t_ratio, 3),
                "opaque_ratio": round(o_ratio, 3),
                "semi_ratio": round(s_ratio, 3),
                "reason": "subject_removed",
            }

        # Check: messy edges (too many semi-transparent pixels)
        if s_ratio > _MAX_SEMI_TRANSPARENT_RATIO:
            return {
                "valid": False,
                "transparent_ratio": round(t_ratio, 3),
                "opaque_ratio": round(o_ratio, 3),
                "semi_ratio": round(s_ratio, 3),
                "reason": "messy_edges",
            }

        return {
            "valid": True,
            "transparent_ratio": round(t_ratio, 3),
            "opaque_ratio": round(o_ratio, 3),
            "semi_ratio": round(s_ratio, 3),
            "reason": "ok",
        }

    except Exception as e:
        logger.warning("validate_transparency_error", error=str(e))
        return {"valid": True, "reason": "validation_error"}  # fail-open


def has_transparency(image_bytes: bytes) -> bool:
    """Check if an image already has meaningful transparency (alpha channel).

    Returns True if the image is a PNG with >15% transparent pixels,
    meaning bg removal is NOT needed.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGBA":
            return False

        alpha = img.getchannel("A")
        pixels = list(alpha.getdata())
        total = len(pixels)
        if total == 0:
            return False

        transparent = sum(1 for p in pixels if p < 10)
        return (transparent / total) >= _MIN_TRANSPARENT_RATIO
    except Exception:
        return False


async def call_local_rembg(rembg_url: str, image_url: str) -> dict[str, Any]:
    """Call the local rembg sidecar. Returns {image_bytes, provider, cost_usd} or {error}."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{rembg_url}/remove",
                json={"image_url": image_url},
            )
            if resp.status_code < 400 and resp.headers.get("content-type", "").startswith("image/"):
                return {"image_bytes": resp.content, "provider": "local-rembg", "cost_usd": 0}
            return {"error": f"local rembg failed ({resp.status_code})", "provider": "local-rembg"}
    except Exception as e:
        logger.debug("bg_removal_local_rembg_error", error=str(e))
        return {"error": f"local rembg error: {e}", "provider": "local-rembg"}


async def call_fal_rembg(fal_api_key: str, image_url: str) -> dict[str, Any]:
    """Call fal.ai rembg + bria fallback. Returns {image_url, provider, cost_usd} or {error}."""
    if not fal_api_key:
        return {"error": "no fal API key configured"}

    headers = {
        "Authorization": f"Key {fal_api_key}",
        "Content-Type": "application/json",
    }

    # Primary: fal-ai/imageutils/rembg (free)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{FAL_SYNC_API}/fal-ai/imageutils/rembg",
                headers=headers,
                json={"image_url": image_url},
            )
            if resp.status_code < 400:
                data = resp.json()
                result_url = data.get("image", {}).get("url")
                if result_url:
                    return {"image_url": result_url, "provider": "fal-rembg", "cost_usd": 0}
    except Exception as e:
        logger.debug("bg_removal_fal_rembg_error", error=str(e))

    # Fallback: fal-ai/bria/rmbg/v2 ($0.018)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{FAL_SYNC_API}/fal-ai/bria/rmbg/v2",
                headers=headers,
                json={"image_url": image_url},
            )
            if resp.status_code < 400:
                data = resp.json()
                result_url = data.get("image", {}).get("url")
                if result_url:
                    return {"image_url": result_url, "provider": "fal-bria", "cost_usd": 0.018}
    except Exception as e:
        logger.debug("bg_removal_fal_bria_error", error=str(e))

    return {"error": "All fal.ai bg-removal providers failed"}


async def upload_to_storage(
    supabase_url: str,
    supabase_key: str,
    source_url: str | None = None,
    source_bytes: bytes | None = None,
) -> str | None:
    """Upload image to Supabase Storage. Accepts raw bytes or URL (downloads first)."""
    try:
        if source_bytes:
            image_bytes = source_bytes
        elif source_url:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(source_url)
                if resp.status_code >= 400:
                    return None
                image_bytes = resp.content
        else:
            return None

        if len(image_bytes) > 10 * 1024 * 1024:  # 10MB safety
            return None

        file_name = f"nobg-{uuid.uuid4().hex[:12]}.png"
        bucket = "designs"
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{file_name}"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "image/png",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(upload_url, headers=headers, content=image_bytes)
            if resp.status_code >= 400:
                logger.warning("bg_removal_upload_failed", status=resp.status_code, detail=resp.text[:200])
                return None

        return f"{supabase_url}/storage/v1/object/public/{bucket}/{file_name}"

    except Exception as e:
        logger.warning("bg_removal_persist_error", error=str(e))
        return None
