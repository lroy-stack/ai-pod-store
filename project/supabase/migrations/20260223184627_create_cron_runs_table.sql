-- Cron Runs Table
-- Tracks execution of scheduled cron jobs with status, timing, and error logging
-- Used for mutual exclusion (preventing overlapping runs) and monitoring

CREATE TABLE cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  duration_ms INTEGER,
  error_message TEXT,
  rows_affected INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on cron_name and started_at for mutual exclusion checks and time-series queries
CREATE INDEX idx_cron_runs_name_started
  ON cron_runs(cron_name, started_at DESC);

-- Index on status for filtering active/failed runs
CREATE INDEX idx_cron_runs_status
  ON cron_runs(status);

-- Index on started_at for cleanup and time-based queries
CREATE INDEX idx_cron_runs_started_at
  ON cron_runs(started_at DESC);

-- RLS Policies
-- This table is for system use only (cron job tracking)
-- Only service_role should have access
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (bypasses RLS by default)
-- No user-facing policies needed since this is system-only

-- Trigger to automatically calculate duration_ms when finished_at is set
CREATE OR REPLACE FUNCTION calculate_cron_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::INTEGER * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cron_runs_calculate_duration
  BEFORE UPDATE ON cron_runs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_cron_duration();

-- Optional: Add a comment for documentation
COMMENT ON TABLE cron_runs IS 'Cron execution tracking - records start/finish times, status, errors, and metrics for scheduled jobs. Used for mutual exclusion and monitoring.';
