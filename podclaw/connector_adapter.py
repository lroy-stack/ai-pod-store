"""
PodClaw — Connector → SDK MCP Server Adapter
===============================================

Converts any PodClaw MCP connector into an in-process McpSdkServerConfig
that the Claude Agent SDK can consume natively.

Each connector exposes get_tools() → {name: {description, input_schema, handler}}.
This module wraps those handlers into SdkMcpTool instances and creates a
single McpSdkServerConfig per connector via create_sdk_mcp_server().

IMAGE PERSISTENCE (store-then-reference):
When a tool returns image_base64, the adapter auto-uploads to Supabase Storage
and replaces the base64 with a public URL. The LLM never sees raw base64 data.
This prevents context bloat (~4MB/image → 100 chars URL) and ensures images
are persisted immediately (no data loss if agent session ends).
"""

from __future__ import annotations

import base64
import json
import os
import uuid
from typing import Any

import httpx
import structlog

from claude_agent_sdk import SdkMcpTool, create_sdk_mcp_server, McpSdkServerConfig

try:
    from mcp.types import ToolAnnotations
except ImportError:
    ToolAnnotations = None  # Fallback if mcp package not available

# Tools safe for parallel execution (read-only, no side effects)
# Per CONNECTORS_DEFINITION.md section 2.4: "Every read-only tool MUST declare readOnlyHint=True"
_READ_ONLY_TOOLS = frozenset({
    # Supabase
    "supabase_query", "supabase_count", "supabase_vector_search",
    # Printful
    "printful_list_products", "printful_get_product", "printful_get_catalog",
    "printful_get_catalog_product", "printful_get_printfiles", "printful_get_file",
    "printful_get_order", "printful_list_webhooks", "printful_get_mockup_result",
    "printful_calculate_shipping", "printful_list_orders",
    # Stripe
    "stripe_get_balance", "stripe_list_charges", "stripe_list_disputes",
    "stripe_get_invoice", "stripe_list_payouts", "stripe_get_revenue_report",
    # Resend
    "resend_list_emails", "resend_get_delivery_stats",
    # Crawl4AI
    "crawl_url", "extract_article", "capture_screenshot", "crawl_batch", "crawl_site",
    # Gemini
    "gemini_check_image_quality", "gemini_embed_text", "gemini_embed_batch",
    # SVG Renderer
    "svg_render_png",
})

logger = structlog.get_logger(__name__)

# Max size for text content returned to the LLM (prevents context bloat)
MAX_TEXT_CONTENT_CHARS = 100_000  # ~25k tokens


async def _persist_image(image_b64: str, mime_type: str, source_tool: str) -> str | None:
    """Upload base64 image to Supabase Storage, return public URL or None on failure."""
    supa_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supa_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not supa_url or not supa_key:
        logger.warning("image_persist_skip", reason="missing SUPABASE env vars")
        return None

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        logger.warning("image_persist_skip", reason="invalid base64")
        return None

    # 5MB limit
    if len(image_bytes) > 5 * 1024 * 1024:
        logger.warning("image_persist_skip", reason="too large", size=len(image_bytes))
        return None

    ext = "jpg" if "jpeg" in mime_type else "png"
    file_name = f"{source_tool}-{uuid.uuid4().hex[:12]}.{ext}"
    bucket = "designs"

    upload_url = f"{supa_url}/storage/v1/object/{bucket}/{file_name}"
    headers = {
        "apikey": supa_key,
        "Authorization": f"Bearer {supa_key}",
        "Content-Type": mime_type,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(upload_url, headers=headers, content=image_bytes)
            if resp.status_code >= 400:
                logger.error("image_persist_failed", status=resp.status_code, detail=resp.text[:200])
                return None

        public_url = f"{supa_url}/storage/v1/object/public/{bucket}/{file_name}"
        logger.info("image_persisted", url=public_url[:80], size=len(image_bytes), source=source_tool)
        return public_url

    except Exception as e:
        logger.error("image_persist_error", error=str(e))
        return None


async def _process_result(result: dict[str, Any], tool_name: str) -> dict[str, Any]:
    """Process a tool result: persist images and build MCP content blocks.

    If the result contains image_base64, uploads to Supabase Storage and
    replaces the base64 with the public URL. The LLM gets a clean JSON
    with URLs instead of megabytes of base64 text.
    """
    content: list[dict[str, str]] = []

    # Check for image data that needs persistence
    if "image_base64" in result and result["image_base64"]:
        mime_type = result.get("mime_type", "image/png")
        image_url = await _persist_image(result["image_base64"], mime_type, tool_name)

        if image_url:
            # Replace base64 with URL — the image is now safe in Storage
            result_clean = {k: v for k, v in result.items() if k != "image_base64"}
            result_clean["image_url"] = image_url
            result_clean["persisted"] = True
            text = json.dumps(result_clean, default=str)
        else:
            # Upload failed — return metadata without the base64 blob
            result_clean = {k: v for k, v in result.items() if k != "image_base64"}
            result_clean["image_url"] = None
            result_clean["persisted"] = False
            result_clean["error"] = "Image generated but auto-upload to Storage failed"
            text = json.dumps(result_clean, default=str)
    else:
        text = json.dumps(result, default=str)

    # Sanitize text to prevent prompt injection from external API responses
    from podclaw.memory_manager import _sanitize_data
    text = _sanitize_data(text)

    # Truncate oversized text responses (safety net)
    if len(text) > MAX_TEXT_CONTENT_CHARS:
        text = text[:MAX_TEXT_CONTENT_CHARS] + "\n... [TRUNCATED — response too large]"

    content.append({"type": "text", "text": text})
    return {"content": content}


def connector_to_mcp_server(name: str, connector: Any) -> McpSdkServerConfig:
    """
    Convert a PodClaw MCP connector to an SDK MCP server config.

    Args:
        name: Connector name (e.g. "stripe", "supabase")
        connector: Any object with a get_tools() method returning
                   {tool_name: {description, input_schema, handler}}

    Returns:
        McpSdkServerConfig usable in ClaudeAgentOptions.mcp_servers
    """
    sdk_tools: list[SdkMcpTool] = []

    for tool_name, tool_def in connector.get_tools().items():
        handler = tool_def["handler"]

        # Factory function to capture handler and tool_name per iteration
        def _make_handler(h, tn):
            async def wrapped(params: dict[str, Any]) -> dict[str, Any]:
                result = await h(params)
                return await _process_result(result, tn)
            return wrapped

        annotations = None
        if ToolAnnotations and tool_name in _READ_ONLY_TOOLS:
            annotations = ToolAnnotations(readOnlyHint=True)

        sdk_tools.append(SdkMcpTool(
            name=tool_name,
            description=tool_def.get("description", ""),
            input_schema=tool_def.get("input_schema", {}),
            handler=_make_handler(handler, tool_name),
            **({"annotations": annotations} if annotations else {}),
        ))

    return create_sdk_mcp_server(name=name, tools=sdk_tools)
