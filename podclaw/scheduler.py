"""
PodClaw — Scheduler
=====================

APScheduler-based daily cycle for the 10 autonomous agents.
Follows the logical production order.

Daily Cycle (UTC):
  06:00 — RESEARCHER       → Finds trends & opportunities
  07:00 — DESIGNER         → Generates designs based on trends
  07:00 — MARKETING (AM)   → Promotes new products
  08:00 — CATALOGER #1     → Creates products with new designs
  09:00 — NEWSLETTER (AM)  → Email campaigns
  10:00 — QA INSPECTOR     → Verifies designs & products quality
  12:00 — CUSTOMER MANAGER #1
  14:00 — CATALOGER #2     → Sync & update existing products
  15:00 — MARKETING (PM)   → Afternoon social push
  16:00 — SEO MANAGER      → Weekly (Sunday only)
  17:00 — NEWSLETTER (PM)  → Evening campaigns
  18:00 — CATALOGER #3     → End-of-day sync
  22:00 — CUSTOMER MANAGER #2
  23:00 — FINANCE          → Daily reconciliation
  23:30 — MEMORY consolidation
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import random

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger

if TYPE_CHECKING:
    from podclaw.core import Orchestrator

logger = structlog.get_logger(__name__)

# Maps agent_name → {hour: task_key} for cycle-specific tasks.
# When the scheduler splits multi-hour crons (e.g. "0 8,14,18 * * *"),
# each hour gets a distinct task_key passed to run_agent().
CYCLE_TASKS: dict[str, dict[int, str]] = {
    "cataloger": {
        8: "cataloger",            # Cycle 1: New Products (2-step pricing)
        14: "cataloger_pricing",   # Cycle 2: Pricing & Inventory
        18: "cataloger_peakprep",  # Cycle 3: Peak Prep
    },
}

# Default schedule configuration
DEFAULT_SCHEDULE = {
    # Sprint 2: Agent crons disabled — now event-driven via CEO messages.
    # Set enabled: True to re-activate if needed (fallback).
    "researcher": {"schedule": "0 6 * * *", "description": "Daily trend research", "model": "haiku", "enabled": False},
    "designer": {"schedule": "0 7 * * *", "description": "Generate designs based on trends", "model": "sonnet", "enabled": False},
    "cataloger": {"schedule": "0 8,14,18 * * *", "description": "Create and update products (3x daily)", "model": "sonnet", "enabled": False},
    "marketing": {"schedule": "0 7,15 * * *", "description": "Social media campaigns (2x daily)", "model": "sonnet", "enabled": False},
    "newsletter": {"schedule": "0 9,17 * * *", "description": "Email campaigns (2x daily)", "model": "sonnet", "enabled": False},
    "customer_manager": {"schedule": "0 12,22 * * *", "description": "Customer support (2x daily)", "model": "sonnet", "enabled": False},
    "seo_manager": {"schedule": "0 16 * * 0", "description": "SEO optimization (weekly, Sunday)", "model": "haiku", "enabled": False},
    "finance": {"schedule": "0 23 * * *", "description": "Daily financial reconciliation", "model": "sonnet", "enabled": False},
    "qa_inspector": {"schedule": "0 10 * * *", "description": "Verify designs and products quality", "model": "haiku", "enabled": False},
    "brand_manager": {"schedule": "0 8 * * 1", "description": "Weekly brand audit and label management", "model": "sonnet", "enabled": False},
}


class PodClawScheduler:
    """Manages the daily agent execution cycle."""

    def __init__(
        self,
        orchestrator: "Orchestrator",
        workspace_root: Path | None = None,
    ):
        self.orchestrator = orchestrator
        self.scheduler = AsyncIOScheduler(
            timezone="UTC",
            job_defaults={"misfire_grace_time": 3600, "coalesce": True},
        )
        self.workspace_root = workspace_root or Path.cwd()
        self.schedule_file = self.workspace_root / "podclaw_schedule.json"
        self.current_schedule = self._load_schedule()
        self._soul_evolution = None
        self._memory_store = None
        self._setup_jobs()

    def _job_target(self, agent_name: str, task_key: str | None = None) -> tuple:
        """Return (callable, args, kwargs) for a scheduled job.

        Always routes directly through orchestrator.run_agent() with
        context enrichment via context_loader.build_cognitive_task().
        """
        if task_key and task_key != agent_name:
            suffix = task_key[len(agent_name) + 1:]
            source = f"cron:{agent_name}:{suffix}"
        else:
            source = f"cron:{agent_name}"
        return (self._run_enriched_agent, [agent_name, source], {})

    async def _run_enriched_agent(self, agent_name: str, source: str) -> dict:
        """Run an agent with cognitive context enrichment."""
        from podclaw.context_loader import build_cognitive_task
        task = build_cognitive_task(source, "Scheduled cycle trigger", self.orchestrator.memory)
        return await self.orchestrator.run_agent(agent_name, task=task)

    def set_soul_evolution(self, soul_evolution) -> None:
        """Set the soul evolution reference for consolidation jobs."""
        self._soul_evolution = soul_evolution

    def set_memory_store(self, memory_store) -> None:
        """Set the memory store reference for decay/pruning jobs."""
        self._memory_store = memory_store

    def _load_schedule(self) -> dict:
        """Load schedule from file or return defaults."""
        if self.schedule_file.exists():
            try:
                with open(self.schedule_file) as f:
                    return json.load(f)
            except Exception as e:
                logger.warning("schedule_load_failed", error=str(e))
        return DEFAULT_SCHEDULE.copy()

    def _save_schedule(self) -> None:
        """Persist current schedule to file."""
        try:
            with open(self.schedule_file, "w") as f:
                json.dump(self.current_schedule, f, indent=2)
            logger.info("schedule_saved", file=str(self.schedule_file))
        except Exception as e:
            logger.error("schedule_save_failed", error=str(e))

    def _parse_cron(self, cron_expr: str) -> CronTrigger:
        """Parse cron expression (minute hour day month weekday) to CronTrigger."""
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {cron_expr}")

        minute, hour, day, month, day_of_week = parts

        return CronTrigger(
            minute=minute,
            hour=hour,
            day=day if day != '*' else None,
            month=month if month != '*' else None,
            day_of_week=day_of_week if day_of_week != '*' else None,
        )

    def _setup_jobs(self) -> None:
        """Configure all scheduled jobs from current schedule config.

        For agents with CYCLE_TASKS mapping and multi-hour crons (e.g.
        "0 8,14,18 * * *"), creates separate jobs per hour with distinct
        task overrides so each cycle runs a different prompt.
        """
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                schedule_str = config["schedule"]
                parts = schedule_str.split()
                hours_field = parts[1] if len(parts) >= 2 else ""

                # Check if this agent needs cycle-specific splitting
                if "," in hours_field and agent_name in CYCLE_TASKS:
                    for hour_str in hours_field.split(","):
                        hour = int(hour_str)
                        single_cron = schedule_str.replace(hours_field, hour_str)
                        trigger = self._parse_cron(single_cron)
                        task_key = CYCLE_TASKS.get(agent_name, {}).get(hour, agent_name)
                        fn, args, kwargs = self._job_target(agent_name, task_key)
                        self.scheduler.add_job(
                            fn,
                            trigger,
                            args=args,
                            kwargs=kwargs,
                            id=f"{agent_name}_h{hour_str}_scheduled",
                            name=f"{agent_name.replace('_', ' ').title()} ({hour_str}:00)",
                        )
                        logger.debug("job_added", agent=agent_name, schedule=single_cron, hour=hour)
                else:
                    trigger = self._parse_cron(schedule_str)
                    fn, args, kwargs = self._job_target(agent_name)
                    self.scheduler.add_job(
                        fn,
                        trigger,
                        args=args,
                        kwargs=kwargs,
                        id=f"{agent_name}_scheduled",
                        name=f"{agent_name.replace('_', ' ').title()}",
                    )
                    logger.debug("job_added", agent=agent_name, schedule=schedule_str)
            except Exception as e:
                logger.error("job_add_failed", agent=agent_name, error=str(e))

        # Production governor: compute daily limits before agents start (05:55 UTC)
        self.scheduler.add_job(
            self._run_governor,
            CronTrigger(hour=5, minute=55),
            id="production_governor",
            name="Production Governor",
        )

        # Always add memory consolidation at 23:30 (with soul review on Sundays)
        self.scheduler.add_job(
            self._run_consolidation_with_soul,
            CronTrigger(hour=23, minute=30),
            id="memory_consolidation",
            name="Memory Consolidation",
        )

        # Session reaper: hourly — clean up stuck sessions (>24h in "running")
        self.scheduler.add_job(
            self._reap_stale_sessions,
            IntervalTrigger(hours=1),
            id="session_reaper",
            name="Session Reaper",
        )

        # Event cleanup: 02:00 UTC daily (off-peak hours, TTL-based cleanup)
        self.scheduler.add_job(
            self._run_event_cleanup,
            CronTrigger(hour=2, minute=0),
            id="event_cleanup",
            name="Event Cleanup (TTL)",
        )

        # Memory decay + pruning: 04:00 UTC daily (before agents start)
        self.scheduler.add_job(
            self._run_memory_decay,
            CronTrigger(hour=4, minute=0),
            id="memory_decay",
            name="Memory Decay & Pruning",
        )

        # Memory health check: 04:10 UTC daily (after decay at 04:00, diagnostic only)
        self.scheduler.add_job(
            self._run_memory_health_check,
            CronTrigger(hour=4, minute=10),
            id="memory_health_check",
            name="Memory Health Check",
        )

        # Memory telemetry snapshot: Sunday 05:00 UTC (observe, no mutations)
        self.scheduler.add_job(
            self._run_memory_snapshot,
            CronTrigger(hour=5, minute=0, day_of_week="sun"),
            id="memory_snapshot",
            name="Memory Telemetry Snapshot",
        )

        # CEO inactivity fallback: every 12h — run fallback agents if CEO inactive > 48h
        self.scheduler.add_job(
            self._run_ceo_inactivity_check,
            IntervalTrigger(hours=12),
            id="ceo_inactivity_check",
            name="CEO Inactivity Check",
        )

        # Memory search reindex: 04:15 UTC daily (after memory decay at 04:00)
        self.scheduler.add_job(
            self._run_memory_reindex,
            CronTrigger(hour=4, minute=15),
            id="memory_search_reindex",
            name="Memory Search Reindex",
        )

        logger.info("scheduler_configured", job_count=len(self.scheduler.get_jobs()))

    async def _run_memory_reindex(self) -> None:
        """Rebuild the FTS5 memory search index from disk files."""
        try:
            from podclaw.memory_search import MemoryIndex
            memory_dir = self.orchestrator.memory.memory_dir
            db_path = memory_dir / "search_index.db"
            index = MemoryIndex(db_path=db_path)
            count = index.rebuild(memory_dir)
            logger.info("memory_search_reindex_complete", documents=count)
        except Exception as e:
            logger.error("memory_search_reindex_failed", error=str(e))

    async def _run_event_cleanup(self) -> None:
        """Delete old events based on TTL retention policies."""
        try:
            from podclaw.cleanup import cleanup_job
            await cleanup_job(event_store=self.orchestrator.events)
        except Exception as e:
            logger.error("event_cleanup_failed", error=str(e))

    async def _run_governor(self) -> None:
        """Compute daily production limits based on market signals."""
        try:
            from podclaw.production_governor import compute_daily_decision, persist_decision
            decision = await compute_daily_decision(
                self.orchestrator.events._client,
                self.orchestrator.state,
            )
            await persist_decision(
                decision,
                self.orchestrator.state,
                self.orchestrator.memory.context_dir,
            )
            logger.info(
                "governor_computed",
                mode=decision.mode,
                product_limit=decision.daily_product_limit,
                design_limit=decision.daily_design_limit,
            )
        except Exception as e:
            logger.error("governor_compute_failed", error=str(e))

    async def _run_consolidation_with_soul(self) -> None:
        """Run consolidation with optional soul evolution review."""
        await self.orchestrator.run_consolidation(
            soul_evolution=self._soul_evolution,
        )

    async def _run_memory_decay(self) -> None:
        """Apply memory decay and pruning to conversation memories."""
        if not self._memory_store:
            return
        try:
            decay_result = await self._memory_store.apply_decay()
            prune_result = await self._memory_store.apply_pruning()
            logger.info(
                "memory_maintenance_complete",
                decayed=decay_result.get("decayed", 0),
                pruned=prune_result.get("pruned", 0),
            )
        except Exception as e:
            logger.error("memory_maintenance_failed", error=str(e))

    async def _run_memory_health_check(self) -> None:
        """Daily cognitive health evaluation (diagnostic, no mutations)."""
        if not self._memory_store:
            return
        try:
            result = await self._memory_store.evaluate_memory_health()
            status = result.get("status", "unknown")
            if status == "critical":
                logger.warning(
                    "memory_health_critical",
                    flags=result.get("flags", []),
                    summary=result.get("summary", ""),
                    action=result.get("recommended_action", ""),
                    **result.get("metrics", {}),
                )
            elif status == "warning":
                logger.info(
                    "memory_health_warning",
                    flags=result.get("flags", []),
                    summary=result.get("summary", ""),
                    action=result.get("recommended_action", ""),
                )
            # healthy → silent (no log)
        except Exception as e:
            logger.error("memory_health_check_failed", error=str(e))

    async def _run_memory_snapshot(self) -> None:
        """Log weekly memory telemetry snapshot (read-only, no mutations)."""
        if not self._memory_store:
            return
        try:
            stats = await self._memory_store.get_memory_stats()
            growth = await self._memory_store.get_memory_growth(days=7)
            logger.info(
                "memory_snapshot",
                total_chunks=stats.get("total_chunks", 0),
                conversation_memory=stats.get("total_conversation_memory", 0),
                by_type=stats.get("by_memory_type", {}),
                by_importance=stats.get("by_importance_range", {}),
                avg_importance=stats.get("avg_importance", 0),
                avg_access=stats.get("avg_access_count", 0),
                zero_access_pct=stats.get("zero_access_pct", 0),
                created_last_7d=growth.get("total_created_in_period", 0),
            )
        except Exception as e:
            logger.error("memory_snapshot_failed", error=str(e))

    async def _run_ceo_inactivity_check(self) -> None:
        """Check if CEO has been inactive > 48h and run fallback agents."""
        try:
            from podclaw.router.fallback import CEOInactivityMonitor
            monitor = CEOInactivityMonitor(self.orchestrator)
            await monitor.check_and_fallback()
        except Exception as e:
            logger.error("ceo_inactivity_check_failed", error=str(e))

    async def _reap_stale_sessions(self) -> None:
        """Mark sessions stuck in 'running' > 24h as 'error'."""
        if not self.orchestrator.events._client:
            return
        try:
            import asyncio
            from datetime import datetime, timedelta, timezone
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            result = await asyncio.to_thread(
                lambda: (
                    self.orchestrator.events._client.table("agent_sessions")
                    .update({
                        "status": "error",
                        "error_log": "session_reaper: stuck > 24h",
                    })
                    .eq("status", "running")
                    .lt("started_at", cutoff)
                    .execute()
                )
            )
            count = len(result.data) if result.data else 0
            if count:
                logger.info("session_reaper_cleaned", count=count)
        except Exception as e:
            logger.warning("session_reaper_failed", error=str(e))

    def start(self) -> None:
        """Start the scheduler."""
        self.scheduler.start()
        logger.info("scheduler_started")

    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        self.scheduler.shutdown(wait=True)
        logger.info("scheduler_stopped")

    def schedule_retry(self, agent_name: str, delay_minutes: int = 15) -> None:
        """Schedule a one-shot deferred retry for an agent after all immediate retries are exhausted.

        Adds random jitter of 0-300 seconds to avoid thundering-herd effects
        when multiple agents fail around the same time.

        Args:
            agent_name: The agent to retry.
            delay_minutes: Base delay before the retry fires (default 15 min).
        """
        from datetime import datetime, timedelta, timezone

        jitter_seconds = random.randint(0, 300)
        run_at = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes, seconds=jitter_seconds)
        job_id = f"{agent_name}_deferred_retry_{int(run_at.timestamp())}"

        fn, args, kwargs = self._job_target(agent_name)
        self.scheduler.add_job(
            fn,
            DateTrigger(run_date=run_at),
            args=args,
            kwargs=kwargs,
            id=job_id,
            name=f"{agent_name.replace('_', ' ').title()} (deferred retry)",
            misfire_grace_time=600,
        )

        logger.info(
            "deferred_retry_scheduled",
            agent=agent_name,
            run_at=run_at.isoformat(),
            jitter_seconds=jitter_seconds,
            job_id=job_id,
        )

    def get_jobs(self) -> list[dict]:
        """Return list of scheduled jobs with next run times."""
        jobs = []
        for job in self.scheduler.get_jobs():
            # APScheduler 4.x uses different attribute
            next_run = getattr(job, 'next_run_time', None) or getattr(job.trigger, 'next_fire_time', None)
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": str(next_run) if next_run else None,
                "trigger": str(job.trigger),
            })
        return jobs

    def pause_agent(self, agent_name: str) -> None:
        """Pause all jobs for a specific agent."""
        for job in self.scheduler.get_jobs():
            if agent_name in job.id:
                job.pause()
                logger.info("job_paused", job_id=job.id)

    def resume_agent(self, agent_name: str) -> None:
        """Resume all jobs for a specific agent."""
        for job in self.scheduler.get_jobs():
            if agent_name in job.id:
                job.resume()
                logger.info("job_resumed", job_id=job.id)

    def get_full_schedule(self) -> dict:
        """Return full schedule configuration with job status."""
        from datetime import datetime

        schedule_list = []
        for agent_name, config in self.current_schedule.items():
            # Find corresponding job(s) — may be split into per-hour jobs
            job = self.scheduler.get_job(f"{agent_name}_scheduled")
            if not job:
                # Look for split jobs (e.g. cataloger_h8_scheduled)
                for j in self.scheduler.get_jobs():
                    if j.id.startswith(f"{agent_name}_h"):
                        job = j
                        break  # Use first matching (earliest hour)
            next_run = None
            if job:
                next_run_time = getattr(job, 'next_run_time', None)
                if next_run_time:
                    if hasattr(next_run_time, 'isoformat'):
                        next_run = next_run_time.isoformat()
                    else:
                        next_run = str(next_run_time)

            schedule_list.append({
                "name": agent_name,
                "model": config.get("model", "sonnet"),
                "schedule": config["schedule"],
                "description": config.get("description", ""),
                "enabled": config.get("enabled", True),
                "nextRun": next_run,
            })

        return {
            "schedule": schedule_list,
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
        }

    def update_schedule(self, new_schedule: list[dict]) -> dict:
        """Update agent schedules and persist changes.

        Handles CYCLE_TASKS agents by splitting multi-hour crons into
        separate per-hour jobs with distinct task overrides.
        """
        # Convert list to dict format
        updated_config = {}
        for agent in new_schedule:
            updated_config[agent["name"]] = {
                "schedule": agent["schedule"],
                "description": agent.get("description", ""),
                "model": agent.get("model", "sonnet"),
                "enabled": agent.get("enabled", True),
            }

        # Remove all existing agent jobs (keep memory consolidation and session_reaper)
        for job in list(self.scheduler.get_jobs()):
            if job.id not in ("memory_consolidation", "session_reaper", "production_governor", "memory_decay", "memory_health_check", "memory_snapshot", "ceo_inactivity_check", "approval_timeout_check"):
                job.remove()

        # Update current schedule and re-add jobs
        self.current_schedule = updated_config
        self._save_schedule()

        # Re-add jobs — replicate _setup_jobs logic for CYCLE_TASKS
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                schedule_str = config["schedule"]
                parts = schedule_str.split()
                hours_field = parts[1] if len(parts) >= 2 else ""

                if "," in hours_field and agent_name in CYCLE_TASKS:
                    for hour_str in hours_field.split(","):
                        hour = int(hour_str)
                        single_cron = schedule_str.replace(hours_field, hour_str)
                        trigger = self._parse_cron(single_cron)
                        task_key = CYCLE_TASKS.get(agent_name, {}).get(hour, agent_name)
                        fn, args, kwargs = self._job_target(agent_name, task_key)
                        self.scheduler.add_job(
                            fn,
                            trigger,
                            args=args,
                            kwargs=kwargs,
                            id=f"{agent_name}_h{hour_str}_scheduled",
                            name=f"{agent_name.replace('_', ' ').title()} ({hour_str}:00)",
                        )
                else:
                    trigger = self._parse_cron(schedule_str)
                    fn, args, kwargs = self._job_target(agent_name)
                    self.scheduler.add_job(
                        fn,
                        trigger,
                        args=args,
                        kwargs=kwargs,
                        id=f"{agent_name}_scheduled",
                        name=f"{agent_name.replace('_', ' ').title()}",
                    )
                logger.info("job_updated", agent=agent_name, schedule=config["schedule"])
            except Exception as e:
                logger.error("job_update_failed", agent=agent_name, error=str(e))

        return self.get_full_schedule()

    def reset_to_defaults(self) -> dict:
        """Reset schedule to default configuration."""
        self.current_schedule = DEFAULT_SCHEDULE.copy()
        self._save_schedule()

        # Remove all existing agent jobs (keep system jobs)
        for job in list(self.scheduler.get_jobs()):
            if job.id not in ("memory_consolidation", "session_reaper", "production_governor", "memory_decay", "memory_health_check", "memory_snapshot", "ceo_inactivity_check", "approval_timeout_check"):
                job.remove()

        # Re-add jobs with default schedules (same CYCLE_TASKS split logic as _setup_jobs)
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                schedule_str = config["schedule"]
                parts = schedule_str.split()
                hours_field = parts[1] if len(parts) >= 2 else ""

                if "," in hours_field and agent_name in CYCLE_TASKS:
                    for hour_str in hours_field.split(","):
                        hour = int(hour_str)
                        single_cron = schedule_str.replace(hours_field, hour_str)
                        trigger = self._parse_cron(single_cron)
                        task_key = CYCLE_TASKS.get(agent_name, {}).get(hour, agent_name)
                        fn, args, kwargs = self._job_target(agent_name, task_key)
                        self.scheduler.add_job(
                            fn,
                            trigger,
                            args=args,
                            kwargs=kwargs,
                            id=f"{agent_name}_h{hour_str}_scheduled",
                            name=f"{agent_name.replace('_', ' ').title()} ({hour_str}:00)",
                        )
                else:
                    trigger = self._parse_cron(schedule_str)
                    fn, args, kwargs = self._job_target(agent_name)
                    self.scheduler.add_job(
                        fn,
                        trigger,
                        args=args,
                        kwargs=kwargs,
                        id=f"{agent_name}_scheduled",
                        name=f"{agent_name.replace('_', ' ').title()}",
                    )
            except Exception as e:
                logger.error("job_reset_failed", agent=agent_name, error=str(e))

        logger.info("schedule_reset_to_defaults")
        return self.get_full_schedule()
