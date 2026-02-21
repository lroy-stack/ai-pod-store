-- Persistent system event queue for inter-agent communication
-- Replaces the in-memory deque that was lost on restart
-- Events are drained by heartbeat and acknowledged by agents

CREATE TABLE IF NOT EXISTS system_events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                      -- agent_name | "cron" | "admin" | "hook"
  event_type TEXT NOT NULL DEFAULT 'message', -- message | alert | dispatch_request | high_priority_action
  payload JSONB NOT NULL DEFAULT '{}',
  wake_mode TEXT NOT NULL DEFAULT 'next-heartbeat' CHECK (wake_mode IN ('now', 'next-heartbeat')),
  target_agent TEXT,                         -- NULL = any agent can handle it
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  handled_by TEXT                            -- agent that processed this event
);

-- Index for heartbeat drain: pending events ordered by creation
CREATE INDEX IF NOT EXISTS idx_system_events_pending
  ON system_events (status, created_at)
  WHERE status = 'pending';

-- Index for urgent events
CREATE INDEX IF NOT EXISTS idx_system_events_urgent
  ON system_events (wake_mode, status)
  WHERE wake_mode = 'now' AND status = 'pending';

-- Auto-cleanup: delete completed events older than 7 days
-- (Run via scheduled function or manual cleanup)
