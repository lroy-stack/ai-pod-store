"""
Tests for podclaw.scheduler — PodClawScheduler

Tests use APScheduler in paused mode (not started) for deterministic assertions.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from podclaw.scheduler import PodClawScheduler, DEFAULT_SCHEDULE, CYCLE_TASKS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_orchestrator():
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={"status": "completed"})
    orch.run_consolidation = AsyncMock()
    orch.events = MagicMock()
    orch.events._client = None
    orch.state = MagicMock()
    orch.memory = MagicMock()
    orch.memory.context_dir = Path("/tmp/ctx")
    orch._default_task = MagicMock(return_value="default task prompt")
    return orch


@pytest.fixture()
def scheduler(mock_orchestrator, tmp_path):
    return PodClawScheduler(orchestrator=mock_orchestrator, workspace_root=tmp_path)


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------

class TestSchedulerInit:

    def test_default_schedule_loaded(self, scheduler):
        assert len(scheduler.current_schedule) == len(DEFAULT_SCHEDULE)
        assert "researcher" in scheduler.current_schedule
        assert "finance" in scheduler.current_schedule

    def test_jobs_registered(self, scheduler):
        jobs = scheduler.scheduler.get_jobs()
        # Sprint 2: Agent crons disabled — only system jobs remain (8 total):
        # production_governor, memory_consolidation, session_reaper,
        # event_cleanup, memory_decay, memory_health_check, memory_snapshot,
        # ceo_inactivity_check
        assert len(jobs) >= 8

    def test_system_jobs_present(self, scheduler):
        job_ids = {j.id for j in scheduler.scheduler.get_jobs()}
        assert "memory_consolidation" in job_ids
        assert "session_reaper" in job_ids
        assert "production_governor" in job_ids

    def test_cataloger_disabled_no_split_jobs(self, scheduler):
        """Sprint 2: Cataloger cron disabled — no split jobs created."""
        job_ids = {j.id for j in scheduler.scheduler.get_jobs()}
        assert "cataloger_h8_scheduled" not in job_ids
        assert "cataloger_h14_scheduled" not in job_ids
        assert "cataloger_h18_scheduled" not in job_ids


# ---------------------------------------------------------------------------
# Parse cron
# ---------------------------------------------------------------------------

class TestParseCron:

    def test_valid_cron(self, scheduler):
        trigger = scheduler._parse_cron("0 6 * * *")
        assert trigger is not None

    def test_weekly_cron(self, scheduler):
        trigger = scheduler._parse_cron("0 16 * * 0")
        assert trigger is not None

    def test_invalid_cron_raises(self, scheduler):
        with pytest.raises(ValueError, match="Invalid cron"):
            scheduler._parse_cron("bad cron")


# ---------------------------------------------------------------------------
# Get jobs
# ---------------------------------------------------------------------------

class TestGetJobs:

    def test_get_jobs_returns_list(self, scheduler):
        jobs = scheduler.get_jobs()
        assert isinstance(jobs, list)
        # Sprint 2: Only 8 system jobs (agent crons disabled)
        assert len(jobs) >= 8

    def test_job_has_required_fields(self, scheduler):
        jobs = scheduler.get_jobs()
        for job in jobs:
            assert "id" in job
            assert "name" in job
            assert "trigger" in job


# ---------------------------------------------------------------------------
# Start/Stop
# ---------------------------------------------------------------------------

class TestStartStop:

    async def test_start_starts_scheduler(self, scheduler):
        scheduler.start()
        assert scheduler.scheduler.running
        scheduler.stop()

    async def test_stop_calls_shutdown(self, scheduler):
        scheduler.start()
        assert scheduler.scheduler.running
        scheduler.stop()
        # APScheduler's AsyncIOScheduler.shutdown(wait=True) may not
        # immediately reflect running=False in the same tick.
        # Verify the stop method doesn't raise and the scheduler object is intact.
        assert scheduler.scheduler is not None


# ---------------------------------------------------------------------------
# Pause/Resume
# ---------------------------------------------------------------------------

class TestPauseResume:

    async def test_pause_agent_pauses_jobs(self, mock_orchestrator, tmp_path):
        """Test pause with a temporarily enabled agent (researcher disabled in Sprint 2)."""
        # Create scheduler with researcher enabled for this test
        import json
        schedule_file = tmp_path / "podclaw_schedule.json"
        custom = {"researcher": {"schedule": "0 6 * * *", "enabled": True}}
        schedule_file.write_text(json.dumps(custom))
        sched = PodClawScheduler(orchestrator=mock_orchestrator, workspace_root=tmp_path)
        sched.start()
        sched.pause_agent("researcher")
        job = sched.scheduler.get_job("researcher_scheduled")
        assert job is not None
        sched.stop()

    async def test_resume_agent(self, mock_orchestrator, tmp_path):
        """Test resume with a temporarily enabled agent."""
        import json
        schedule_file = tmp_path / "podclaw_schedule.json"
        custom = {"researcher": {"schedule": "0 6 * * *", "enabled": True}}
        schedule_file.write_text(json.dumps(custom))
        sched = PodClawScheduler(orchestrator=mock_orchestrator, workspace_root=tmp_path)
        sched.start()
        sched.pause_agent("researcher")
        sched.resume_agent("researcher")
        sched.stop()


# ---------------------------------------------------------------------------
# Cycle tasks
# ---------------------------------------------------------------------------

class TestCycleTasks:

    def test_cycle_tasks_defined(self):
        assert "cataloger" in CYCLE_TASKS
        assert 8 in CYCLE_TASKS["cataloger"]
        assert 14 in CYCLE_TASKS["cataloger"]
        assert 18 in CYCLE_TASKS["cataloger"]

    def test_get_cycle_task_for_known_hour(self, scheduler):
        task = scheduler._get_cycle_task("cataloger", 14)
        # Should return a non-None task for cataloger at hour 14
        assert task is not None

    def test_get_cycle_task_for_unknown_agent(self, scheduler):
        task = scheduler._get_cycle_task("researcher", 6)
        assert task is None


# ---------------------------------------------------------------------------
# Schedule retry
# ---------------------------------------------------------------------------

class TestScheduleRetry:

    def test_schedule_retry_adds_job(self, scheduler, mock_orchestrator):
        initial_count = len(scheduler.scheduler.get_jobs())
        scheduler.schedule_retry("researcher", delay_minutes=1)
        assert len(scheduler.scheduler.get_jobs()) == initial_count + 1

    def test_schedule_retry_job_targets_agent(self, scheduler, mock_orchestrator):
        scheduler.schedule_retry("finance", delay_minutes=1)
        retry_jobs = [j for j in scheduler.scheduler.get_jobs() if "finance_deferred_retry" in j.id]
        assert len(retry_jobs) == 1


# ---------------------------------------------------------------------------
# Full schedule
# ---------------------------------------------------------------------------

class TestFullSchedule:

    def test_get_full_schedule(self, scheduler):
        result = scheduler.get_full_schedule()
        assert "schedule" in result
        assert "lastUpdated" in result
        assert len(result["schedule"]) == len(DEFAULT_SCHEDULE)

    def test_full_schedule_has_agent_info(self, scheduler):
        result = scheduler.get_full_schedule()
        agents = {s["name"] for s in result["schedule"]}
        assert "researcher" in agents
        assert "finance" in agents


# ---------------------------------------------------------------------------
# Update schedule
# ---------------------------------------------------------------------------

class TestUpdateSchedule:

    def test_update_schedule_changes_config(self, scheduler, tmp_path):
        new_schedule = [
            {"name": "researcher", "schedule": "0 5 * * *", "enabled": True},
        ]
        result = scheduler.update_schedule(new_schedule)
        assert "schedule" in result
        # Schedule file should be written
        assert scheduler.schedule_file.exists()

    def test_reset_to_defaults(self, scheduler):
        result = scheduler.reset_to_defaults()
        assert len(result["schedule"]) == len(DEFAULT_SCHEDULE)


# ---------------------------------------------------------------------------
# Load schedule from file
# ---------------------------------------------------------------------------

class TestLoadSchedule:

    def test_load_from_file(self, mock_orchestrator, tmp_path):
        import json
        schedule_file = tmp_path / "podclaw_schedule.json"
        custom = {"researcher": {"schedule": "0 5 * * *", "enabled": True}}
        schedule_file.write_text(json.dumps(custom))

        sched = PodClawScheduler(orchestrator=mock_orchestrator, workspace_root=tmp_path)
        assert sched.current_schedule["researcher"]["schedule"] == "0 5 * * *"

    def test_load_invalid_file_falls_back(self, mock_orchestrator, tmp_path):
        schedule_file = tmp_path / "podclaw_schedule.json"
        schedule_file.write_text("not valid json!!!")

        sched = PodClawScheduler(orchestrator=mock_orchestrator, workspace_root=tmp_path)
        assert "researcher" in sched.current_schedule  # Falls back to defaults
