"""
PodClaw — Quality Gate Hook (PostToolUse)
============================================

Mechanical verification checks — zero LLM cost, deterministic.

Checks (all fire-and-forget, never block the agent):
- gemini_generate_image / fal_generate → verify image_url present
- printify_create → verify Supabase row exists (sync_hook should have created it)
- supabase_insert on designs → verify image_url and moderation_status present
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
        if tool_name in ("gemini_generate_image", "fal_generate"):
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

        # --- Check 2: printify_create → verify Supabase row exists ---
        elif tool_name == "printify_create":
            if output and isinstance(output, dict):
                printify_id = output.get("id")
                if printify_id:
                    # Give sync_hook 3 seconds to insert the row
                    await asyncio.sleep(3)
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            url = (
                                f"{supabase_url}/rest/v1/products"
                                f"?printify_id=eq.{printify_id}&select=id"
                            )
                            resp = await client.get(url, headers=headers)
                            rows = resp.json() if resp.status_code < 400 else []
                            if not rows:
                                logger.error(
                                    "quality_gate_product_not_synced",
                                    printify_id=printify_id,
                                )
                                if event_queue:
                                    try:
                                        await event_queue.push({
                                            "type": "quality_gate_fail",
                                            "tool": "printify_create",
                                            "reason": "product_not_in_supabase",
                                            "printify_id": str(printify_id),
                                        })
                                    except Exception:
                                        pass
                            else:
                                logger.info(
                                    "quality_gate_product_synced",
                                    printify_id=printify_id,
                                )
                    except Exception as e:
                        logger.warning(
                            "quality_gate_sync_check_error",
                            printify_id=printify_id,
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

        # --- Check 5: printify_publish → verify variants, translations, and GPSR ---
        elif tool_name == "printify_publish":
            product_id_printify = (tool_input.get("product_id", "") if isinstance(tool_input, dict) else "")
            if product_id_printify:
                # sync_hook runs BEFORE quality_gate now, so data should be ready
                await asyncio.sleep(1)
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        # Find product in Supabase by printify_id
                        url = (
                            f"{supabase_url}/rest/v1/products"
                            f"?printify_id=eq.{product_id_printify}"
                            f"&select=id,title,translations,product_details"
                        )
                        resp = await client.get(url, headers=headers)
                        products = resp.json() if resp.status_code < 400 else []
                        if products:
                            pid = products[0]["id"]
                            title = products[0].get("title", "?")[:50]
                            translations = products[0].get("translations") or {}
                            product_details = products[0].get("product_details") or {}

                            # Check variants
                            vurl = (
                                f"{supabase_url}/rest/v1/product_variants"
                                f"?product_id=eq.{pid}&select=id&limit=1"
                            )
                            vresp = await client.get(vurl, headers=headers)
                            vrows = vresp.json() if vresp.status_code < 400 else []
                            if not vrows:
                                logger.error(
                                    "quality_gate_no_variants_after_publish",
                                    printify_id=product_id_printify,
                                    title=title,
                                )
                                if event_queue:
                                    try:
                                        await event_queue.push({
                                            "type": "quality_gate_fail",
                                            "tool": "printify_publish",
                                            "reason": "no_variants_in_supabase",
                                            "printify_id": str(product_id_printify),
                                        })
                                    except Exception:
                                        pass
                            else:
                                logger.info(
                                    "quality_gate_variants_ok_after_publish",
                                    printify_id=product_id_printify,
                                )

                            # Check translations
                            if not translations or translations == {}:
                                logger.warning(
                                    "quality_gate_no_translations_after_publish",
                                    printify_id=product_id_printify,
                                    title=title,
                                )

                            # Check GPSR safety_information (EU compliance)
                            safety_info = product_details.get("safety_information") if isinstance(product_details, dict) else None
                            if not safety_info:
                                logger.warning(
                                    "quality_gate_no_gpsr_after_publish",
                                    printify_id=product_id_printify,
                                    title=title,
                                )
                                if event_queue:
                                    try:
                                        await event_queue.push({
                                            "type": "quality_gate_fail",
                                            "tool": "printify_publish",
                                            "reason": "missing_gpsr_safety_information",
                                            "printify_id": str(product_id_printify),
                                        })
                                    except Exception:
                                        pass
                except Exception as e:
                    logger.warning(
                        "quality_gate_publish_check_error",
                        printify_id=product_id_printify,
                        error=str(e),
                    )

        return {}

    return _hook
