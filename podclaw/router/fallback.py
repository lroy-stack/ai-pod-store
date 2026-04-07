"""
PodClaw — CEO Inactivity Fallback
====================================

If the CEO hasn't sent any messages in 48 hours, automatically run
essential agents (researcher, qa_inspector, finance) to keep the
store operational.

Runs as a scheduled job every 12 hours.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

import structlog

from podclaw.redis_store import get_redis

if TYPE_CHECKING:
    from podclaw.core import Orchestrator

logger = structlog.get_logger(__name__)

# Redis key for tracking CEO's last message timestamp
CEO_LAST_MESSAGE_KEY = "ceo:last_message_at"

# Threshold: 48 hours in seconds
INACTIVITY_THRESHOLD = 48 * 3600

# Agents to run when CEO is inactive
FALLBACK_AGENTS = ("researcher", "qa_inspector", "finance")


class CEOInactivityMonitor:
    """Monitor CEO activity and trigger fallback agents if inactive."""

    def __init__(self, orchestrator: "Orchestrator"):
        self._orchestrator = orchestrator

    async def check_and_fallback(self) -> None:
        """Check CEO activity and run fallback agents if inactive > 48h."""
        try:
            r = get_redis()
            if not r:
                logger.debug("ceo_inactivity_no_redis")
                return

            last_msg = await r.get(CEO_LAST_MESSAGE_KEY)
            if not last_msg:
                logger.debug("ceo_inactivity_no_record")
                return

            elapsed = time.time() - float(last_msg)
            if elapsed <= INACTIVITY_THRESHOLD:
                logger.debug(
                    "ceo_active",
                    hours_since_last=round(elapsed / 3600, 1),
                )
                return

            logger.info(
                "ceo_inactive_triggering_fallback",
                hours_since_last=round(elapsed / 3600, 1),
                agents=FALLBACK_AGENTS,
            )

            for agent_name in FALLBACK_AGENTS:
                try:
                    await self._orchestrator.run_agent(agent_name)
                    logger.info("fallback_agent_completed", agent=agent_name)
                except Exception as e:
                    logger.error(
                        "fallback_agent_failed",
                        agent=agent_name,
                        error=str(e),
                    )

        except Exception as e:
            logger.error("ceo_inactivity_check_failed", error=str(e))


async def record_ceo_activity() -> None:
    """Record that the CEO sent a message (called from gateway handlers)."""
    try:
        r = get_redis()
        if r:
            await r.set(CEO_LAST_MESSAGE_KEY, str(time.time()))
    except Exception as e:
        logger.warning("record_ceo_activity_failed", error=str(e))
