-- Add index on is_active for filtering active categories
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active) WHERE is_active = true;
