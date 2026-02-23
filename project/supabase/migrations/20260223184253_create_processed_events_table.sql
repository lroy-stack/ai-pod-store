-- Processed Events Table
-- Webhook deduplication table to prevent duplicate processing of webhook events
-- Tracks provider, event_id, event_type, processing timestamp, and HTTP status

CREATE TABLE processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(255) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE constraint on (provider, event_id) to prevent duplicate processing
CREATE UNIQUE INDEX idx_processed_events_provider_event_id
  ON processed_events(provider, event_id);

-- Index on provider for faster lookups by provider
CREATE INDEX idx_processed_events_provider
  ON processed_events(provider);

-- Index on processed_at for time-based queries and cleanup
CREATE INDEX idx_processed_events_processed_at
  ON processed_events(processed_at);

-- RLS Policies
-- This table is for system use only (webhook processing)
-- Only service_role should have access
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (bypasses RLS by default)
-- No user-facing policies needed since this is system-only

-- Optional: Add a comment for documentation
COMMENT ON TABLE processed_events IS 'Webhook deduplication table - tracks processed events by provider and event_id to prevent duplicate processing';
