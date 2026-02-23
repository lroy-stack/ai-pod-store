-- Create cron_runs table for tracking cron job executions
-- Purpose: Track all cron job runs with status, timing, and error information
-- Features: Status CHECK constraint, mutual exclusion tracking

CREATE TABLE IF NOT EXISTS cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name varchar(255) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'running',
  duration_ms integer,
  error_message text,
  rows_affected integer,
  CONSTRAINT cron_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'skipped'))
);

-- Create index for querying by cron name and start time
CREATE INDEX IF NOT EXISTS idx_cron_runs_name_started
  ON cron_runs(cron_name, started_at DESC);

-- Create additional index for status queries (useful for monitoring)
CREATE INDEX IF NOT EXISTS idx_cron_runs_status
  ON cron_runs(status, started_at DESC);

-- Enable RLS (restrict to service_role only)
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON cron_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE cron_runs IS 'Tracks execution of scheduled cron jobs with status, timing, and error information';
COMMENT ON COLUMN cron_runs.cron_name IS 'Unique identifier for the cron job';
COMMENT ON COLUMN cron_runs.status IS 'Current status: running, completed, failed, or skipped';
COMMENT ON COLUMN cron_runs.duration_ms IS 'Execution duration in milliseconds (finished_at - started_at)';
COMMENT ON COLUMN cron_runs.rows_affected IS 'Number of rows affected by the cron job (if applicable)';
