-- A/B Testing Framework tables
-- Phase 12: ab_experiments and ab_events

CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '{"control": {}, "test": {}}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_events (
  id BIGSERIAL PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'revenue')),
  value NUMERIC,
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_ab_events_experiment_variant ON ab_events(experiment_id, variant);
CREATE INDEX IF NOT EXISTS idx_ab_events_created_at ON ab_events(created_at DESC);

-- RLS Policies
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_events ENABLE ROW LEVEL SECURITY;

-- ab_experiments: Admin-only access
CREATE POLICY "Admin can manage experiments"
  ON ab_experiments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ab_events: Insert only (no auth required for tracking)
CREATE POLICY "Anyone can insert events"
  ON ab_events
  FOR INSERT
  WITH CHECK (true);

-- ab_events: Read only for admins
CREATE POLICY "Admin can read events"
  ON ab_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
