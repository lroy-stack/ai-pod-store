-- Add soft-delete support for GDPR compliance
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Create index for active users queries
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- RLS policy: Users cannot see deleted accounts
CREATE POLICY users_hide_deleted ON users
  FOR SELECT
  USING (deleted_at IS NULL);
