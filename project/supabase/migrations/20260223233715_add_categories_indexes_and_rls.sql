-- Add indexes and enable RLS on categories table
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
