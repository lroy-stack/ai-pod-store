"""
PodClaw — Transparency Hook (PostToolUse)
============================================

Infrastructure-level enforcement of PNG transparency for all generated images.

Intercepts: gemini_generate_image, fal_generate_image
After successful generation -> auto-removes background -> persists bg-removed version
to Supabase Storage -> auto-upscales if below print target -> updates designs row.

Requires: Docker rembg-sidecar on REMBG_URL (localhost:8090). No cloud fallback.

Fire-and-forget: never blocks the agent.

Catch-up hook: intercepts supabase_insert on designs table to apply
pending bg_removed_url values that were computed before the row existed.
"""

from __future__ import annotations

import asyncio
import io
from typing import Any, Callable, Optional
from urllib.parse import quote

import httpx
import structlog

from podclaw.bg_removal import call_local_rembg, call_fal_rembg, upload_to_storage, validate_transparency
from podclaw.hooks._parse_output import parse_tool_output

logger = structlog.get_logger(__name__)

# Pending bg removals: original_image_url -> bg_removed_url
# Used by the catch-up hook when the designs row didn't exist yet at hook time.
# NOTE: In-memory only — lost on restart. This is acceptable because:
# 1. The window is short (seconds between image gen and supabase_insert)
# 2. On restart, QA inspector re-checks designs missing bg_removed_url
# 3. reconcile_and_fix.py pass_d also backfills missing bg_removed_url
_pending_bg_removals: dict[str, str] = {}

# Minimum print width (px) — images below this get auto-upscaled
_MIN_PRINT_WIDTH = 3000

_MAX_UPDATE_RETRIES = 3
_RETRY_DELAY_SECONDS = 5


async def _auto_upscale(
    fal_key: str,
    supabase_url: str,
    supabase_key: str,
    image_url: str,
) -> str | None:
    """Auto-upscale a bg-removed image if it's below print resolution.

    Downloads image, checks dimensions, upscales with ESRGAN if needed.
    Returns new persisted URL or None if upscale not needed / failed.
    """
    try:
        from PIL import Image
        from podclaw.image_pipeline.dimensions import get_upscale_factor, DEFAULT_PRODUCT

        # Download to check dimensions
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(image_url)
            if resp.status_code >= 400:
                return None
            image_bytes = resp.content

        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size

        if max(w, h) >= _MIN_PRINT_WIDTH:
            logger.debug("auto_upscale_skip", width=w, height=h, reason="already_large_enough")
            return None

        # Determine scale factor based on default product target
        scale = get_upscale_factor(DEFAULT_PRODUCT)
        has_alpha = img.mode == "RGBA"

        headers = {
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json",
        }

        if has_alpha:
            # Split RGB and alpha, upscale separately, recombine
            rgb = img.convert("RGB")
            alpha = img.getchannel("A")

            rgb_buf = io.BytesIO()
            rgb.save(rgb_buf, format="PNG")

            temp_url = await upload_to_storage(
                supabase_url, supabase_key, source_bytes=rgb_buf.getvalue()
            )
            if not temp_url:
                return None

            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "https://fal.run/fal-ai/esrgan",
                    headers=headers,
                    json={"image_url": temp_url, "scale": scale},
                )
                if resp.status_code >= 400:
                    logger.warning("auto_upscale_esrgan_fail", status=resp.status_code)
                    return None
                data = resp.json()

            upscaled_rgb_url = data.get("image", {}).get("url") or data.get("image_url")
            if not upscaled_rgb_url:
                return None

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(upscaled_rgb_url)
                resp.raise_for_status()
                upscaled_rgb = Image.open(io.BytesIO(resp.content)).convert("RGB")

            new_w, new_h = upscaled_rgb.size
            upscaled_alpha = alpha.resize((new_w, new_h), Image.BICUBIC)
            r, g, b = upscaled_rgb.split()
            final = Image.merge("RGBA", (r, g, b, upscaled_alpha))

            final_buf = io.BytesIO()
            final.save(final_buf, format="PNG")

            persisted = await upload_to_storage(
                supabase_url, supabase_key, source_bytes=final_buf.getvalue()
            )
        else:
            # No alpha — direct ESRGAN
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "https://fal.run/fal-ai/esrgan",
                    headers=headers,
                    json={"image_url": image_url, "scale": scale},
                )
                if resp.status_code >= 400:
                    logger.warning("auto_upscale_esrgan_fail", status=resp.status_code)
                    return None
                data = resp.json()

            upscaled_url = data.get("image", {}).get("url") or data.get("image_url")
            if not upscaled_url:
                return None

            persisted = await upload_to_storage(
                supabase_url, supabase_key, source_url=upscaled_url
            )
            new_w = w * scale
            new_h = h * scale

        if persisted:
            logger.info(
                "auto_upscale_ok",
                original=f"{w}x{h}",
                result=f"{new_w}x{new_h}",
                scale=scale,
                has_alpha=has_alpha,
            )
        return persisted

    except Exception as e:
        logger.error(
            "auto_upscale_error",
            error=str(e),
            image_url=image_url[:80],
        )
        # Mark design for retry — match on image_url (original, not bg_removed)
        try:
            encoded = quote(image_url, safe="")
            async with httpx.AsyncClient(timeout=10) as mark_client:
                resp = await mark_client.patch(
                    f"{supabase_url}/rest/v1/designs?image_url=eq.{encoded}",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation",
                    },
                    json={"needs_upscale": True},
                )
                if resp.status_code < 400 and resp.json():
                    logger.info("auto_upscale_marked_for_retry", image_url=image_url[:60])
        except Exception:
            pass  # Best-effort — don't mask original error
        return None


async def _update_design_row(
    supabase_url: str,
    supabase_key: str,
    original_url: str,
    bg_removed_url: str,
) -> bool:
    """Update designs table with bg_removed_url if a row with image_url matches.

    Returns True if at least one row was updated.
    Uses URL-encoding and retry loop to handle timing gaps (row may not exist yet).
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    encoded_url = quote(original_url, safe="")

    for attempt in range(1, _MAX_UPDATE_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Overwrite bg_removed_url UNLESS it already has a proper nobg- PNG.
                # The LLM agent may set bg_removed_url = image_url (same JPEG), so
                # we can't rely on IS NULL alone.
                resp = await client.patch(
                    f"{supabase_url}/rest/v1/designs?image_url=eq.{encoded_url}&bg_removed_url=not.like.*nobg-*",
                    headers=headers,
                    json={
                        "bg_removed_url": bg_removed_url,
                        "bg_removed_at": "now()",
                    },
                )
                if resp.status_code < 400:
                    rows = resp.json()
                    if rows:
                        logger.info(
                            "transparency_design_updated",
                            design_id=rows[0].get("id", "?"),
                            attempt=attempt,
                        )
                        return True
                    else:
                        logger.debug(
                            "transparency_design_no_match",
                            original_url=original_url[:80],
                            attempt=attempt,
                        )
                else:
                    logger.warning(
                        "transparency_design_update_http_error",
                        status=resp.status_code,
                        detail=resp.text[:200],
                        attempt=attempt,
                    )
        except Exception as e:
            logger.debug("transparency_design_update_error", error=str(e), attempt=attempt)

        if attempt < _MAX_UPDATE_RETRIES:
            await asyncio.sleep(_RETRY_DELAY_SECONDS)

    # All retries exhausted — store for catch-up hook
    logger.info(
        "transparency_design_deferred",
        original_url=original_url[:80],
        bg_removed_url=bg_removed_url[:80],
    )
    _pending_bg_removals[original_url] = bg_removed_url
    return False


# ---------------------------------------------------------------------------
# Hook factory — transparency_hook (PostToolUse)
# ---------------------------------------------------------------------------

def transparency_hook(
    supabase_url: str,
    supabase_key: str,
    rembg_url: str = "",
    fal_key: str = "",
) -> Callable:
    """
    Factory: creates a PostToolUse hook that auto-removes backgrounds
    from generated images using the local rembg Docker sidecar,
    then auto-upscales if below print resolution.

    Intercepts: gemini_generate_image, fal_generate_image
    Pipeline: detect image -> remove bg (local rembg) -> auto-upscale -> persist to Storage -> update designs row
    """
    supabase_url = supabase_url.rstrip("/")

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")

        if tool_name not in ("gemini_generate_image", "fal_generate_image"):
            return {}

        output = parse_tool_output(input_data.get("tool_output", ""))
        if not output:
            return {}

        # Get the image URL (connector_adapter already persisted it to Storage)
        image_url = output.get("image_url")
        if not image_url:
            # fal_generate_image may return images list instead
            images = output.get("images", [])
            if images and isinstance(images, list):
                first = images[0]
                image_url = first.get("url") if isinstance(first, dict) else first
        if not image_url:
            return {}

        # Skip if already bg-removed (e.g. OpenAI transparent output)
        if output.get("bg_removed") or output.get("transparent"):
            return {}

        # --- Remove background: local rembg + quality validation + cloud fallback ---
        if not rembg_url:
            logger.warning("transparency_hook_no_rembg", error="REMBG_URL not configured")
            return {}

        result = await call_local_rembg(rembg_url, image_url)
        provider = result.get("provider", "local-rembg")
        persisted_url: str | None = None

        if result.get("image_bytes"):
            # Validate alpha channel quality before persisting
            quality = validate_transparency(result["image_bytes"])

            if not quality["valid"]:
                logger.warning(
                    "transparency_local_quality_fail",
                    reason=quality["reason"],
                    transparent=quality.get("transparent_ratio"),
                    opaque=quality.get("opaque_ratio"),
                    semi=quality.get("semi_ratio"),
                    original=image_url[:60],
                )

                # Fallback to fal.ai cloud (Bria model — better quality)
                import os
                fal_key = os.environ.get("FAL_KEY", "")
                if fal_key:
                    cloud_result = await call_fal_rembg(fal_key, image_url)
                    if cloud_result.get("image_url"):
                        persisted_url = await upload_to_storage(
                            supabase_url, supabase_key,
                            source_url=cloud_result["image_url"],
                        )
                        provider = cloud_result.get("provider", "fal-cloud")
                        logger.info(
                            "transparency_cloud_fallback_ok",
                            provider=provider,
                            original=image_url[:60],
                        )

                # If cloud also failed, REJECT — do NOT persist garbage
                if not persisted_url:
                    logger.error(
                        "transparency_bg_removal_rejected",
                        reason="local_quality_fail_and_cloud_fallback_fail",
                        quality_reason=quality.get("reason"),
                        original=image_url[:60],
                    )
                    return {}
            else:
                # Local result is good — persist it
                persisted_url = await upload_to_storage(
                    supabase_url, supabase_key,
                    source_bytes=result["image_bytes"],
                )
        elif result.get("image_url"):
            # fal.ai returned a URL -- download then upload
            persisted_url = await upload_to_storage(
                supabase_url, supabase_key,
                source_url=result["image_url"],
            )
            provider = result.get("provider", "fal-cloud")

        if not persisted_url:
            logger.warning(
                "transparency_hook_failed",
                original=image_url[:80],
                error=result.get("error"),
                provider=provider,
            )
            return {}

        logger.info(
            "fal_bg_removed",
            provider=provider,
            url=persisted_url[:80],
        )

        # Auto-upscale if below print resolution
        if fal_key:
            upscaled_url = await _auto_upscale(
                fal_key, supabase_url, supabase_key, persisted_url
            )
            if upscaled_url:
                persisted_url = upscaled_url

        # Wait briefly for the agent to insert the designs row
        await asyncio.sleep(5)

        # Update designs table if row exists (with retry + deferred fallback)
        await _update_design_row(supabase_url, supabase_key, image_url, persisted_url)

        return {}

    return _hook


# ---------------------------------------------------------------------------
# Catch-up hook factory — transparency_catchup_hook (PostToolUse)
# ---------------------------------------------------------------------------

def transparency_catchup_hook(
    supabase_url: str,
    supabase_key: str,
) -> Callable:
    """
    Factory: creates a PostToolUse hook that catches supabase_insert on designs
    and applies any pending bg_removed_url values.

    This solves the timing gap: transparency_hook runs on gemini_generate_image
    BEFORE the agent inserts the designs row. When the row is finally inserted,
    this hook checks _pending_bg_removals and applies the update.
    """
    supabase_url = supabase_url.rstrip("/")

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")

        if tool_name != "supabase_insert":
            return {}

        tool_input = input_data.get("tool_input", {})

        # Only intercept inserts to the designs table
        table = tool_input.get("table", "")
        if table != "designs":
            return {}

        # Extract image_url from the inserted data
        data = tool_input.get("data", {})
        if isinstance(data, str):
            import json
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                return {}

        # Normalize: batch insert (list) → iterate each row
        rows = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

        for row in rows:
            image_url = row.get("image_url", "") if isinstance(row, dict) else ""
            if not image_url:
                continue

            # Check if we have a pending bg_removed_url for this image
            bg_removed_url = _pending_bg_removals.pop(image_url, None)
            if not bg_removed_url:
                continue

            logger.info(
                "transparency_catchup_triggered",
                image_url=image_url[:80],
                bg_removed_url=bg_removed_url[:80],
            )

            # Small delay to let the insert commit
            await asyncio.sleep(1)

            # Apply the deferred update
            await _update_design_row(supabase_url, supabase_key, image_url, bg_removed_url)

        return {}

    return _hook
