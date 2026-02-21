-- Product metadata enrichment: flexible JSONB for product details + per-variant image
-- Allows storing material, care instructions, print technique, manufacturing country, etc.

-- Flexible metadata JSONB for products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_details JSONB DEFAULT '{}'::jsonb;

-- Per-variant mockup image URL
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;

-- GIN index for metadata queries (supports @> containment, ? key existence)
CREATE INDEX IF NOT EXISTS idx_products_product_details ON products USING GIN (product_details);
