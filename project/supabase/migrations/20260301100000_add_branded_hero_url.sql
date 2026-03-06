-- Add branded_hero_url column for custom mockup backgrounds
-- This column survives Printify cron sync (not included in sync upsert row)
ALTER TABLE products ADD COLUMN IF NOT EXISTS branded_hero_url TEXT;

COMMENT ON COLUMN products.branded_hero_url IS 'Branded hero mockup URL (Supabase Storage). Survives Printify cron sync.';

CREATE INDEX IF NOT EXISTS idx_products_branded_hero ON products (branded_hero_url) WHERE branded_hero_url IS NOT NULL;
