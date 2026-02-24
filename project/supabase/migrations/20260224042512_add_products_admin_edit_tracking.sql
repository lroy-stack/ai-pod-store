-- Add admin edit tracking columns to products table
-- Purpose: Track when products are manually edited by admins to preserve edits during Printify sync

ALTER TABLE products
ADD COLUMN IF NOT EXISTS admin_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN products.admin_edited_at IS 'Timestamp when admin last edited title, description, or tags (preserves admin edits during sync)';
COMMENT ON COLUMN products.last_synced_at IS 'Timestamp of last Printify sync (used to determine if admin edits are newer)';
