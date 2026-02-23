-- Add index on parent_id for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
