-- Heartbeat + Soul Evolution tables for PodClaw Learning System
-- 2026-02-15

-- Heartbeat events log
CREATE TABLE IF NOT EXISTS heartbeat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,  -- 'check', 'alert', 'dispatch', 'skip'
  priority INTEGER NOT NULL DEFAULT 1,
  source VARCHAR(50),
  agent_name VARCHAR(50),
  message TEXT,
  fingerprint VARCHAR(64),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_events_type
  ON heartbeat_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeat_events_fingerprint
  ON heartbeat_events(fingerprint, created_at DESC);

-- Soul change log (tracks proposed/applied/rejected SOUL.md mutations)
CREATE TABLE IF NOT EXISTS soul_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id VARCHAR(36) NOT NULL,
  section VARCHAR(100) NOT NULL,
  old_content TEXT,
  new_content TEXT,
  reasoning TEXT,
  diff TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(100),
  review_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_soul_change_log_status
  ON soul_change_log(status, created_at DESC);

-- Update agent_sessions session_type constraint to include heartbeat + consolidation
ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_session_type_check;
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_session_type_check
  CHECK (session_type IN (
    'researcher', 'marketing', 'designer', 'newsletter',
    'cataloger', 'customer_manager', 'seo_manager', 'finance',
    'heartbeat', 'consolidation'
  ));
