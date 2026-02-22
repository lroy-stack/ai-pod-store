-- Create error_logs table for storing client-side and server-side errors
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  error_hash TEXT NOT NULL UNIQUE, -- Hash of message+stack for deduplication
  count INTEGER DEFAULT 1, -- Number of times this error occurred
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on error_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_error_logs_error_hash ON error_logs(error_hash);

-- Create index on last_seen for cleanup queries
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs(last_seen DESC);

-- Create index on first_seen for analytics
CREATE INDEX IF NOT EXISTS idx_error_logs_first_seen ON error_logs(first_seen DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_error_logs_updated_at
  BEFORE UPDATE ON error_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_error_logs_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage error_logs"
  ON error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to insert errors (for client-side error reporting)
CREATE POLICY "Authenticated users can insert error_logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow anonymous users to insert errors (for error reporting before login)
CREATE POLICY "Anonymous users can insert error_logs"
  ON error_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

COMMENT ON TABLE error_logs IS 'Stores client-side and server-side errors with deduplication';
COMMENT ON COLUMN error_logs.error_hash IS 'SHA256 hash of message+stack for deduplication';
COMMENT ON COLUMN error_logs.count IS 'Number of times this error has occurred';
COMMENT ON COLUMN error_logs.first_seen IS 'Timestamp when error was first seen';
COMMENT ON COLUMN error_logs.last_seen IS 'Timestamp when error was last seen';
