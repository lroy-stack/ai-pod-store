"""
PodClaw — Approval Timeout Checker
======================================

Cron job that:
1. Sends reminders for approvals pending > 4 hours
2. Auto-timeouts approvals pending > 24 hours
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

REMINDER_THRESHOLD = timedelta(hours=4)
TIMEOUT_THRESHOLD = timedelta(hours=24)


class ApprovalTimeoutChecker:
    """Check for stale approvals and send reminders or auto-timeout."""

    def __init__(self, supabase_client: Any, responder: Any):
        self._db = supabase_client
        self._responder = responder

    async def check(self) -> dict[str, int]:
        """Run timeout check. Returns counts of reminders and timeouts."""
        from podclaw.gateway.models import Platform

        reminders_sent = 0
        timeouts_applied = 0
        now = datetime.now(timezone.utc)

        try:
            result = (
                self._db.table("ceo_approvals")
                .select("id, resource_type, resource_id, platform, created_at")
                .eq("status", "pending")
                .execute()
            )
            pending = result.data or []
        except Exception as e:
            logger.error("timeout_check_query_failed", error=str(e))
            return {"reminders": 0, "timeouts": 0}

        for approval in pending:
            created = datetime.fromisoformat(approval["created_at"].replace("Z", "+00:00"))
            age = now - created
            platform_str = approval.get("platform", "whatsapp")

            try:
                platform = Platform(platform_str)
            except ValueError:
                platform = Platform.WHATSAPP

            if age > TIMEOUT_THRESHOLD:
                # Auto-timeout
                try:
                    self._db.table("ceo_approvals").update({
                        "status": "timeout",
                        "resolved_at": now.isoformat(),
                    }).eq("id", approval["id"]).execute()

                    await self._responder.send_to_ceo(
                        platform,
                        f"Aprobacion de {approval['resource_type']} expirada (>24h). "
                        f"ID: {approval['resource_id'][:8]}..."
                    )
                    timeouts_applied += 1
                except Exception as e:
                    logger.error("timeout_apply_failed", id=approval["id"], error=str(e))

            elif age > REMINDER_THRESHOLD:
                # Send reminder
                try:
                    hours = int(age.total_seconds() / 3600)
                    await self._responder.send_to_ceo(
                        platform,
                        f"Recordatorio: tienes un(a) {approval['resource_type']} pendiente de aprobacion "
                        f"({hours}h). Responde con los botones de aprobar/rechazar."
                    )
                    reminders_sent += 1
                except Exception as e:
                    logger.error("reminder_send_failed", id=approval["id"], error=str(e))

        if reminders_sent or timeouts_applied:
            logger.info(
                "timeout_check_complete",
                reminders=reminders_sent,
                timeouts=timeouts_applied,
                pending_total=len(pending),
            )

        return {"reminders": reminders_sent, "timeouts": timeouts_applied}
