"""
PodClaw — Quality Gate Hook (PostToolUse)
============================================

Mechanical verification checks — zero LLM cost, deterministic.

Checks (all fire-and-forget, never block the agent):
- gemini_generate_image / fal_generate_image → verify image_url present
- printful_create_product → verify Supabase row exists (sync_hook should have created it)
- supabase_insert on designs → verify image_url and moderation_status present
- resend_send_email → verify HTML uses newsletter/support template (not composed from scratch)
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Optional

import httpx
import structlog

from podclaw.hooks._parse_output import parse_tool_output

logger = structlog.get_logger(__name__)


def quality_gate_hook(
    supabase_url: str,
    supabase_key: str,
    event_queue: Any = None,
) -> Callable:
    """
    Factory: creates a PostToolUse hook that performs mechanical verification checks.

    Zero LLM cost — all checks are deterministic Python code.
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    async def _hook(
        input_data: dict[str, Any],
        tool_use_id: Optional[str] = None,
        context: Optional[Any] = None,
    ) -> dict[str, Any]:
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_output = input_data.get("tool_output", "")

        output = parse_tool_output(tool_output)

        # --- Check 1: Image generation produced a valid result ---
        if tool_name in ("gemini_generate_image", "fal_generate_image"):
            if not output or not isinstance(output, dict) or (not output.get("image_url") and not output.get("images")):
                logger.error(
                    "quality_gate_no_image",
                    tool=tool_name,
                    has_output=output is not None,
                )
                if event_queue:
                    try:
                        await event_queue.push({
                            "type": "quality_gate_fail",
                            "tool": tool_name,
                            "reason": "no_image_produced",
                        })
                    except Exception:
                        pass
            else:
                logger.debug("quality_gate_image_ok", tool=tool_name)

        # --- Check 2: printful_create_product → verify Supabase row exists ---
        elif tool_name == "printful_create_product":
            if output and isinstance(output, dict):
                # Printful returns {result: {id: ..., ...}}
                result = output.get("result", output)
                printful_id = result.get("id") if isinstance(result, dict) else None
                if printful_id:
                    # Give sync_hook 3 seconds to insert the row
                    await asyncio.sleep(3)
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            url = (
                                f"{supabase_url}/rest/v1/products"
                                f"?printful_id=eq.{printful_id}&select=id"
                            )
                            resp = await client.get(url, headers=headers)
                            rows = resp.json() if resp.status_code < 400 else []
                            if not rows:
                                logger.error(
                                    "quality_gate_product_not_synced",
                                    printful_id=printful_id,
                                )
                                if event_queue:
                                    try:
                                        await event_queue.push({
                                            "type": "quality_gate_fail",
                                            "tool": "printful_create_product",
                                            "reason": "product_not_in_supabase",
                                            "printful_id": str(printful_id),
                                        })
                                    except Exception:
                                        pass
                            else:
                                logger.info(
                                    "quality_gate_product_synced",
                                    printful_id=printful_id,
                                )
                    except Exception as e:
                        logger.warning(
                            "quality_gate_sync_check_error",
                            printful_id=printful_id,
                            error=str(e),
                        )

        # --- Check 3: supabase_insert on products → warn about missing required fields ---
        elif tool_name == "supabase_insert":
            table = tool_input.get("table", "") if isinstance(tool_input, dict) else ""
            if table == "products" and output and isinstance(output, dict):
                data = output if "title" in output else output.get("data", {})
                if isinstance(data, list) and data:
                    data = data[0] if isinstance(data[0], dict) else {}
                if isinstance(data, dict):
                    issues = []
                    desc = data.get("description", "")
                    if desc and (desc.startswith("{") or desc.startswith("[")):
                        issues.append("description contains JSON (must be plain text)")
                    if not data.get("translations"):
                        issues.append("missing translations")
                    if not data.get("product_details"):
                        issues.append("missing product_details")
                    if issues:
                        logger.warning(
                            "quality_gate_product_data_issues",
                            product_title=data.get("title", "?")[:50],
                            issues=issues,
                        )

            # --- Check 4: supabase_insert on designs → required fields ---
            if table == "designs":
                data = tool_input.get("data", {}) if isinstance(tool_input, dict) else {}
                # data may be a list (batch insert) — check first record
                if isinstance(data, list) and data:
                    data = data[0]
                if isinstance(data, dict):
                    if not data.get("image_url"):
                        logger.error("quality_gate_design_no_image_url")
                    if not data.get("moderation_status"):
                        logger.warning("quality_gate_design_no_moderation_status")

        # --- Check 5: resend_send_email → verify template fingerprints in HTML ---
        elif tool_name == "resend_send_email":
            html = tool_input.get("html", "") if isinstance(tool_input, dict) else ""
            if html and len(html) > 200:
                # Template fingerprints from newsletter-promo.html and layout.html
                _TEMPLATE_MARKERS = (
                    'class="mob-pad"',
                    'class="dark-card"',
                    "letter-spacing:3px",
                )
                has_template = any(marker in html for marker in _TEMPLATE_MARKERS)
                if not has_template:
                    logger.warning(
                        "quality_gate_email_no_template",
                        html_len=len(html),
                        to=tool_input.get("to", "?"),
                    )
                    if event_queue:
                        try:
                            from podclaw.event_queue import SystemEvent
                            await event_queue.push(SystemEvent(
                                source="quality_gate",
                                event_type="quality_gate_email_no_template",
                                payload={
                                    "to": tool_input.get("to", "?"),
                                    "subject": tool_input.get("subject", "?")[:100],
                                    "html_len": len(html),
                                },
                                wake_mode="next-heartbeat",
                            ))
                        except Exception:
                            pass
                else:
                    logger.debug("quality_gate_email_template_ok", to=tool_input.get("to", "?"))

        return {}

    return _hook
