-- Account deletion grace period (GDPR compliance)
-- Implements soft delete with 30-day grace period before hard deletion

-- Add deletion tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for finding accounts pending deletion
CREATE INDEX IF NOT EXISTS idx_users_deletion_requested
  ON users(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL AND deleted_at IS NULL;

-- Create index for finding hard-deletable accounts
CREATE INDEX IF NOT EXISTS idx_users_pending_hard_delete
  ON users(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN users.deletion_requested_at IS 'Timestamp when user requested account deletion (soft delete marker)';
COMMENT ON COLUMN users.deleted_at IS 'Timestamp when account was soft-deleted (30-day grace period starts here)';
