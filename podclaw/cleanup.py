"""
PodClaw — Automatic Event Cleanup
==================================

Periodic cleanup of old events from Supabase to prevent unbounded growth.

Retention policies:
- agent_events: 90 days (3 months)
- heartbeat_events: 30 days (1 month)
- agent_daily_costs: 90 days (3 months)
- session_transcripts: 90 days (3 months)

Runs daily at 02:00 UTC (off-peak hours).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

import structlog

if TYPE_CHECKING:
    from podclaw.event_store import EventStore

logger = structlog.get_logger(__name__)

# Retention periods in days
RETENTION_POLICIES = {
    "agent_events": 90,
    "heartbeat_events": 30,
    "agent_daily_costs": 90,
    "session_transcripts": 90,
}


async def cleanup_old_events(
    event_store: "EventStore | None" = None,
    supabase_client: Any = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Delete events older than retention period.

    Args:
        event_store: EventStore instance (provides supabase client)
        supabase_client: Direct Supabase client (alternative to event_store)
        dry_run: If True, only count records without deleting

    Returns:
        Dict mapping table_name -> deleted_count
    """
    # Get Supabase client
    if event_store:
        client = event_store._client
    elif supabase_client:
        client = supabase_client
    else:
        logger.warning("cleanup_skipped", reason="No Supabase client provided")
        return {}

    if not client:
        logger.warning("cleanup_skipped", reason="Supabase client not initialized")
        return {}

    results = {}
    total_deleted = 0

    for table, retention_days in RETENTION_POLICIES.items():
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
            cutoff_iso = cutoff_date.isoformat()

            # Count records to delete
            count_result = await asyncio.to_thread(
                lambda: client.table(table)
                .select("id", count="exact")
                .lt("created_at", cutoff_iso)
                .execute()
            )

            count = count_result.count if count_result.count is not None else 0

            if count == 0:
                logger.info("cleanup_no_old_records", table=table, retention_days=retention_days)
                results[table] = 0
                continue

            if dry_run:
                logger.info(
                    "cleanup_dry_run",
                    table=table,
                    would_delete=count,
                    cutoff=cutoff_iso,
                    retention_days=retention_days,
                )
                results[table] = count
                continue

            # Delete old records
            delete_result = await asyncio.to_thread(
                lambda: client.table(table)
                .delete()
                .lt("created_at", cutoff_iso)
                .execute()
            )

            deleted_count = len(delete_result.data) if delete_result.data else count
            total_deleted += deleted_count
            results[table] = deleted_count

            logger.info(
                "cleanup_completed",
                table=table,
                deleted=deleted_count,
                cutoff=cutoff_iso,
                retention_days=retention_days,
            )

        except Exception as e:
            logger.error("cleanup_failed", table=table, error=str(e))
            results[table] = 0

    if not dry_run and total_deleted > 0:
        logger.info("cleanup_total", tables=len(results), total_deleted=total_deleted)

    return results


async def cleanup_job(event_store: "EventStore | None" = None, supabase_client: Any = None) -> None:
    """
    Scheduled cleanup job (called by APScheduler).

    This is the entry point for the scheduler - it wraps cleanup_old_events()
    and logs the results.
    """
    logger.info("cleanup_job_started")
    results = await cleanup_old_events(event_store=event_store, supabase_client=supabase_client)
    total = sum(results.values())
    logger.info("cleanup_job_completed", results=results, total_deleted=total)


def get_retention_policy(table_name: str) -> int | None:
    """Get retention period in days for a table."""
    return RETENTION_POLICIES.get(table_name)


def get_all_retention_policies() -> dict[str, int]:
    """Get all retention policies."""
    return dict(RETENTION_POLICIES)
