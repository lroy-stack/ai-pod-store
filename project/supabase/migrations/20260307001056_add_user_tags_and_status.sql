ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'disabled', 'suspended'))
