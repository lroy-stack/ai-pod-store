-- Create abandoned_carts table to track cart recovery emails
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id varchar(255),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  locale varchar(10) NOT NULL DEFAULT 'en',
  first_email_sent_at timestamptz,
  second_email_sent_at timestamptz,
  cart_last_updated_at timestamptz NOT NULL,
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abandoned_carts_identifier_check CHECK (
    (session_id IS NOT NULL AND user_id IS NULL) OR
    (session_id IS NULL AND user_id IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session_id ON abandoned_carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user_id ON abandoned_carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_sent ON abandoned_carts(first_email_sent_at, second_email_sent_at) WHERE recovered_at IS NULL;

-- Create unique constraint to prevent duplicate tracking entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_unique_session
  ON abandoned_carts(session_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_unique_user
  ON abandoned_carts(user_id)
  WHERE user_id IS NOT NULL;

-- RLS policies (service role only for cron operations)
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage abandoned carts"
  ON abandoned_carts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_abandoned_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER abandoned_carts_updated_at
  BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_abandoned_carts_updated_at();
