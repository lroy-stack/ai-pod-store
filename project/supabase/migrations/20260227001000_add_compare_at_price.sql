-- Add compare_at_price_cents to products for sale/strikethrough pricing
-- NULL = no sale. When set, must be greater than base_price_cents.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER;

-- Add CHECK constraint as a table constraint (allows NULL)
ALTER TABLE products
ADD CONSTRAINT chk_compare_at_price_gt_base
CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents > base_price_cents);

-- Partial index for quick lookups of products on sale
CREATE INDEX IF NOT EXISTS idx_products_compare_at_price
ON products(compare_at_price_cents)
WHERE compare_at_price_cents IS NOT NULL;

COMMENT ON COLUMN products.compare_at_price_cents IS 'Original price before discount. NULL = no sale.';
