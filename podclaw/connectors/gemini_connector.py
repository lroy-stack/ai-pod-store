"""
PodClaw — Gemini MCP Connector
=================================

Google Gemini AI services:
- Text embeddings (cataloger, newsletter — RAG and personalization)
- Image generation (designer — Gemini 2.0 Flash image generation, fallback for fal.ai)
- Image quality check (designer — AI slop detection via vision)
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import httpx
import structlog

from podclaw.connectors._shared import CircuitBreaker, RateLimiter, _err

logger = structlog.get_logger(__name__)

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_IMAGE_MODEL = os.environ.get(
    "GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview"
)

_QUALITY_CHECK_PROMPT = """\
Analyze this product design image for print-on-demand quality.
Be CRITICAL. A score of 10 should be EXCEPTIONAL and rare. Most images score 6-8.

Check for these specific issues and score 1-10:
1. ANATOMY: Extra/missing fingers, deformed faces, distorted limbs
2. TEXT: Misspellings, garbled/unreadable text, wrong characters
3. ARTIFACTS: Blurring, color bleeding, noise, watermarks
4. COMPOSITION: Centered, balanced, suitable for print on products
5. RESOLUTION: Sharp enough for print (subjective from image quality)
6. BACKGROUND: Must be white, transparent, or a simple solid color. Complex/busy backgrounds = FAIL
7. ISOLATION: Must be a standalone graphic/artwork. If the image shows a MOCKUP of a product \
(e.g. a t-shirt with a design printed on it, a mug with artwork, a poster on a wall), \
it is NOT a clean design — cap score at 5 maximum and mark as FAIL

AI-GENERATED IMAGE RED FLAGS (note in issues but don't auto-fail):
- Overly smooth/plastic skin textures
- Perfect bilateral symmetry (unnatural)
- Generic "stock photo" feel with no artistic intent
- Inconsistent lighting or shadow directions

For EACH issue found, describe EXACTLY what you see and WHERE in the image.

Respond in JSON only — no markdown fences, no explanation:
{"passed": true/false, "score": 1-10, "issues": ["list of specific problems found"], "details": "one-sentence summary"}
A score >= 7 with no critical anatomy/text/background/mockup issues = passed.
If the image has NO people or text, skip those checks and focus on artifacts/composition/resolution/background/isolation."""


class GeminiMCPConnector:
    """In-process MCP connector for Google Gemini (embeddings + image gen + vision)."""

    def __init__(self, api_key: str):
        self._key = api_key
        self._circuit_breaker = CircuitBreaker(name="gemini", failure_threshold=5, timeout=60.0)
        self._rate_limiter = RateLimiter(60)  # 60 req/min (free tier)

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
            # gemini_generate_image REMOVED — use fal_generate_image with gpt-image-1.5 instead
            "gemini_check_image_quality": {
                "description": (
                    "Quality gate — low cost. Analyze an image for AI artifacts and print quality "
                    "using Gemini vision. Checks for: extra fingers, deformed faces, text errors, "
                    "blurring, composition issues. Returns a score (1-10) — score >= 7 = passed. "
                    "MUST be called on EVERY image (sourced or generated) before Printful upload."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "image_url": {
                            "type": "string",
                            "description": "Public HTTPS URL of the image to analyze",
                        },
                    },
                    "required": ["image_url"],
                },
                "handler": self._check_image,
            },
        }

    # ------------------------------------------------------------------
    # Embeddings (existing)
    # ------------------------------------------------------------------

    async def _embed_text(self, params: dict[str, Any]) -> dict[str, Any]:
        model = "models/gemini-embedding-001"
        url = f"{GEMINI_API}/{model}:embedContent"
        body = {
            "model": model,
            "content": {"parts": [{"text": params["text"]}]},
        }
        if params.get("task_type"):
            body["taskType"] = params["task_type"]

        await self._rate_limiter.acquire()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, headers=self._auth_headers(), json=body)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                data = resp.json()
                return {"embedding": data.get("embedding", {}).get("values", [])}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Embed text failed: {e}")

    async def _embed_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        model = "models/gemini-embedding-001"
        url = f"{GEMINI_API}/{model}:batchEmbedContents"
        requests = [
            {
                "model": model,
                "content": {"parts": [{"text": t}]},
                **({"taskType": params["task_type"]} if params.get("task_type") else {}),
            }
            for t in params["texts"]
        ]
        body = {"requests": requests}

        await self._rate_limiter.acquire()
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, headers=self._auth_headers(), json=body)
                resp.raise_for_status()
                self._circuit_breaker.record_success()
                data = resp.json()
                embeddings = [e.get("values", []) for e in data.get("embeddings", [])]
                return {"embeddings": embeddings, "count": len(embeddings)}
        except Exception as e:
            self._circuit_breaker.record_failure()
            return _err(f"Batch embed failed: {e}")

    # ------------------------------------------------------------------
    # Image Generation (new)
    # ------------------------------------------------------------------

    def _auth_headers(self) -> dict[str, str]:
        return {
            "x-goog-api-key": self._key,
            "Content-Type": "application/json",
        }

    async def _generate_image(self, params: dict[str, Any]) -> dict[str, Any]:
        model = f"models/{GEMINI_IMAGE_MODEL}"
        url = f"{GEMINI_API}/{model}:generateContent"
        generation_config: dict[str, Any] = {
            "responseModalities": ["IMAGE", "TEXT"],
        }
        # imageConfig for aspect ratio and resolution (Gemini 3 Pro feature)
        image_config: dict[str, str] = {}
        if params.get("aspect_ratio"):
            image_config["aspectRatio"] = params["aspect_ratio"]
        if params.get("image_size"):
            image_config["imageSize"] = params["image_size"]
        else:
            image_config["imageSize"] = "2K"  # Default to 2K for print quality
        if image_config:
            generation_config["imageConfig"] = image_config

        body = {
            "contents": [{"parts": [{"text": params["prompt"]}]}],
            "generationConfig": generation_config,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=self._auth_headers(), json=body)
            if resp.status_code >= 400:
                error_detail = resp.text[:500]
                logger.error("gemini_generate_image_failed", status=resp.status_code, detail=error_detail)
                return {"error": f"Gemini image generation failed ({resp.status_code}): {error_detail}"}
            data = resp.json()

        # Extract image from response
        candidates = data.get("candidates", [])
        if not candidates:
            return {"error": "No candidates in Gemini response"}

        parts = candidates[0].get("content", {}).get("parts", [])
        image_base64 = None
        mime_type = "image/png"
        text_response = ""

        for part in parts:
            if "inlineData" in part:
                image_base64 = part["inlineData"]["data"]
                mime_type = part["inlineData"].get("mimeType", "image/png")
            elif "text" in part:
                text_response += part["text"]

        if not image_base64:
            return {"error": "No image data in Gemini response", "text": text_response}

        logger.info(
            "gemini_image_generated",
            mime_type=mime_type,
            base64_length=len(image_base64),
        )

        return {
            "image_base64": image_base64,
            "mime_type": mime_type,
            "text": text_response,
            "model": GEMINI_IMAGE_MODEL,
        }

    # ------------------------------------------------------------------
    # Image Quality Check (new)
    # ------------------------------------------------------------------

    async def _check_image(self, params: dict[str, Any]) -> dict[str, Any]:
        image_url = params["image_url"]

        # Download image to get bytes
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                img_resp = await client.get(image_url)
                img_resp.raise_for_status()
            except Exception as e:
                return {"error": f"Failed to download image: {e}", "passed": False, "score": 0}

        image_bytes = img_resp.content
        content_type = img_resp.headers.get("content-type", "image/png")
        # Normalize mime type
        if "jpeg" in content_type or "jpg" in content_type:
            mime_type = "image/jpeg"
        elif "webp" in content_type:
            mime_type = "image/webp"
        else:
            mime_type = "image/png"

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # Send to Gemini vision for analysis
        model = f"models/{GEMINI_IMAGE_MODEL}"
        url = f"{GEMINI_API}/{model}:generateContent"
        body = {
            "contents": [{
                "parts": [
                    {"inlineData": {"mimeType": mime_type, "data": image_b64}},
                    {"text": _QUALITY_CHECK_PROMPT},
                ],
            }],
            "generationConfig": {
                "responseModalities": ["TEXT"],
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=self._auth_headers(), json=body)
            if resp.status_code >= 400:
                error_detail = resp.text[:500]
                logger.error("gemini_check_image_failed", status=resp.status_code, detail=error_detail)
                return {"error": f"Gemini vision check failed ({resp.status_code})", "passed": False, "score": 0}
            data = resp.json()

        # Parse response
        candidates = data.get("candidates", [])
        if not candidates:
            return {"error": "No candidates in Gemini vision response", "passed": False, "score": 0}

        text = ""
        for part in candidates[0].get("content", {}).get("parts", []):
            if "text" in part:
                text += part["text"]

        # Parse JSON from response
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("gemini_check_image_parse_failed", text=text[:200])
            return {
                "error": "Could not parse Gemini quality response",
                "raw_response": text[:500],
                "passed": False,
                "score": 0,
            }

        passed = result.get("passed", False)
        score = result.get("score", 0)
        issues = result.get("issues", [])
        details = result.get("details", "")

        # Sanity: score 10 with 0 issues is suspicious — cap at 9
        if score == 10 and not issues:
            score = 9
            details = details + " (capped: perfect scores require documented evidence)"

        # Sanity: issues found but score still >= 9 — cap at 8
        if issues and score >= 9:
            score = min(score, 8)

        passed = score >= 7 and not any(
            kw in (i.lower() if isinstance(i, str) else "")
            for i in issues
            for kw in ("fail", "mockup", "anatomy", "deformed")
        )

        logger.info(
            "gemini_image_checked",
            passed=passed,
            score=score,
            issues_count=len(issues),
        )

        return {
            "passed": passed,
            "score": score,
            "issues": issues,
            "details": details,
        }
