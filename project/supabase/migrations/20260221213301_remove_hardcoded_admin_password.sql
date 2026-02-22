-- Security Hardening: Remove hardcoded admin passwords
-- This migration adds password rotation capabilities and marks default admins for password change

-- Add must_change_password flag to users table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Mark any admin users with default passwords as requiring password change
-- This flags admin@podstore.local, admin@podai.com, admin@podclaw.com for forced rotation
UPDATE users
SET must_change_password = TRUE
WHERE role = 'admin'
  AND email IN ('admin@podstore.local', 'admin@podai.com', 'admin@podclaw.com')
  AND must_change_password = FALSE;

-- Add index for faster password change checks
CREATE INDEX IF NOT EXISTS idx_users_must_change_password
ON users(must_change_password)
WHERE must_change_password = TRUE;

-- Comment for documentation
COMMENT ON COLUMN users.must_change_password IS
'Security flag: User must change password on next login. Used for default/compromised passwords.';
