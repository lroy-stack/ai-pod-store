"""
PodClaw — Scheduler
=====================

APScheduler-based daily cycle for the 8 sub-agents.
Follows the logical production order.

Daily Cycle (UTC):
  06:00 — RESEARCHER       → Finds trends & opportunities
  07:00 — DESIGNER         → Generates designs based on trends
  08:00 — CATALOGER #1     → Creates products with new designs
  07:00 — MARKETING (AM)   → Promotes new products
  09:00 — NEWSLETTER (AM)  → Email campaigns
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

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

if TYPE_CHECKING:
    from podclaw.core import Orchestrator

logger = structlog.get_logger(__name__)

# Default schedule configuration
DEFAULT_SCHEDULE = {
    "researcher": {"schedule": "0 6 * * *", "description": "Daily trend research", "model": "haiku", "enabled": True},
    "designer": {"schedule": "0 7 * * *", "description": "Generate designs based on trends", "model": "sonnet", "enabled": True},
    "cataloger": {"schedule": "0 8,14,18 * * *", "description": "Create and update products (3x daily)", "model": "sonnet", "enabled": True},
    "marketing": {"schedule": "0 7,15 * * *", "description": "Social media campaigns (2x daily)", "model": "sonnet", "enabled": True},
    "newsletter": {"schedule": "0 9,17 * * *", "description": "Email campaigns (2x daily)", "model": "sonnet", "enabled": True},
    "customer_manager": {"schedule": "0 12,22 * * *", "description": "Customer support (2x daily)", "model": "sonnet", "enabled": True},
    "seo_manager": {"schedule": "0 16 * * 0", "description": "SEO optimization (weekly, Sunday)", "model": "haiku", "enabled": True},
    "finance": {"schedule": "0 23 * * *", "description": "Daily financial reconciliation", "model": "sonnet", "enabled": True},
}


class PodClawScheduler:
    """Manages the daily agent execution cycle."""

    def __init__(self, orchestrator: "Orchestrator", workspace_root: Path | None = None):
        self.orchestrator = orchestrator
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self.workspace_root = workspace_root or Path.cwd()
        self.schedule_file = self.workspace_root / "podclaw_schedule.json"
        self.current_schedule = self._load_schedule()
        self._setup_jobs()

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
        """Configure all scheduled jobs from current schedule config."""
        # Add jobs for each agent based on current schedule
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                trigger = self._parse_cron(config["schedule"])
                self.scheduler.add_job(
                    self.orchestrator.run_agent,
                    trigger,
                    args=[agent_name],
                    id=f"{agent_name}_scheduled",
                    name=f"{agent_name.replace('_', ' ').title()}",
                )
                logger.debug("job_added", agent=agent_name, schedule=config["schedule"])
            except Exception as e:
                logger.error("job_add_failed", agent=agent_name, error=str(e))

        # Always add memory consolidation at 23:30
        self.scheduler.add_job(
            self.orchestrator.run_consolidation,
            CronTrigger(hour=23, minute=30),
            id="memory_consolidation",
            name="Memory Consolidation",
        )

        logger.info("scheduler_configured", job_count=len(self.scheduler.get_jobs()))

    def start(self) -> None:
        """Start the scheduler."""
        self.scheduler.start()
        logger.info("scheduler_started")

    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        self.scheduler.shutdown(wait=True)
        logger.info("scheduler_stopped")

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
            # Find corresponding job
            job = self.scheduler.get_job(f"{agent_name}_scheduled")
            next_run = None
            if job:
                # APScheduler 4.x uses different attribute
                next_run_time = getattr(job, 'next_run_time', None) or getattr(job.trigger, 'next_fire_time', None)
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
        """Update agent schedules and persist changes."""
        # Convert list to dict format
        updated_config = {}
        for agent in new_schedule:
            updated_config[agent["name"]] = {
                "schedule": agent["schedule"],
                "description": agent.get("description", ""),
                "model": agent.get("model", "sonnet"),
                "enabled": agent.get("enabled", True),
            }

        # Remove all existing agent jobs (keep memory consolidation)
        for job in list(self.scheduler.get_jobs()):
            if job.id != "memory_consolidation":
                job.remove()

        # Update current schedule and re-add jobs
        self.current_schedule = updated_config
        self._save_schedule()

        # Re-add jobs with new schedules
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                trigger = self._parse_cron(config["schedule"])
                self.scheduler.add_job(
                    self.orchestrator.run_agent,
                    trigger,
                    args=[agent_name],
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

        # Remove all existing agent jobs
        for job in list(self.scheduler.get_jobs()):
            if job.id != "memory_consolidation":
                job.remove()

        # Re-add jobs with default schedules
        for agent_name, config in self.current_schedule.items():
            if not config.get("enabled", True):
                continue

            try:
                trigger = self._parse_cron(config["schedule"])
                self.scheduler.add_job(
                    self.orchestrator.run_agent,
                    trigger,
                    args=[agent_name],
                    id=f"{agent_name}_scheduled",
                    name=f"{agent_name.replace('_', ' ').title()}",
                )
            except Exception as e:
                logger.error("job_reset_failed", agent=agent_name, error=str(e))

        logger.info("schedule_reset_to_defaults")
        return self.get_full_schedule()
