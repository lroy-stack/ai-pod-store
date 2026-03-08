-- Dead Letter Queue for failed webhook events
-- Captures events that handlers failed to process, preventing silent data loss

CREATE TABLE IF NOT EXISTS webhook_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  resource_id TEXT,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  retried_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_webhook_dlq_pending ON webhook_dead_letters(provider, created_at)
  WHERE retried_at IS NULL;
