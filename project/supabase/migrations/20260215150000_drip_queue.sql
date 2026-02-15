-- Email drip queue table for scheduled email sequences
CREATE TABLE IF NOT EXISTS drip_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  sequence VARCHAR(50) NOT NULL,
  step INTEGER NOT NULL,
  template VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_queue_pending
  ON drip_queue(status, send_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_drip_queue_user
  ON drip_queue(user_id, sequence);
