"""
rembg Sidecar — Local Background Removal Service
===================================================

HTTP API for PodClaw transparency_hook and fal_connector.
Runs u2net model locally, zero cloud cost.

POST /remove  — Remove background (accepts image_url JSON, returns raw PNG)
GET  /health  — Health check
"""

from __future__ import annotations

import io

import httpx
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from PIL import Image
from rembg import remove, new_session

app = FastAPI(title="rembg-sidecar", version="1.0.0")

# Pre-load model at startup (already downloaded in Dockerfile)
_session = new_session("u2net")


class RemoveRequest(BaseModel):
    image_url: str


@app.post("/remove")
async def remove_background(req: RemoveRequest) -> Response:
    """Remove background from image. Returns raw PNG bytes."""
    # Download image
    try:
        headers = {"User-Agent": "rembg-sidecar/1.0"}
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            resp = await client.get(req.image_url, headers=headers)
            if resp.status_code >= 400:
                raise HTTPException(502, f"Failed to download image: {resp.status_code}")
            image_bytes = resp.content
    except httpx.TimeoutException:
        raise HTTPException(504, "Image download timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Image download error: {e}")

    # Size guard: 10MB max
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image too large (max 10MB)")

    # Run rembg
    try:
        input_image = Image.open(io.BytesIO(image_bytes))
        output_image = remove(input_image, session=_session)

        buffer = io.BytesIO()
        output_image.save(buffer, format="PNG")
        result_bytes = buffer.getvalue()
    except Exception as e:
        raise HTTPException(500, f"Background removal failed: {e}")

    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={
            "X-Provider": "local-rembg",
            "X-Model": "u2net",
            "X-Cost-USD": "0",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok", "model": "u2net", "provider": "local-rembg"}
