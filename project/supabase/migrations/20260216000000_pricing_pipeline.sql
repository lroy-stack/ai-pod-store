-- Pricing Pipeline: cost tracking columns + currency fix
-- Part of PodClaw pricing pipeline fix (Feb 2026)

-- Cost tracking columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_cents INTEGER;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cost_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printify_cost_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_fee_cents INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_cents INTEGER;

-- Fix currency defaults (initial schema had 'usd')
ALTER TABLE products ALTER COLUMN currency SET DEFAULT 'EUR';
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'EUR';
UPDATE products SET currency = 'EUR' WHERE lower(currency) = 'usd' OR currency = 'eur';
UPDATE orders SET currency = 'EUR' WHERE lower(currency) = 'usd' OR currency = 'eur';

-- Index for Finance margin queries
CREATE INDEX IF NOT EXISTS idx_products_cost ON products(cost_cents) WHERE cost_cents IS NOT NULL;

-- FIX: Ampliar status CHECK constraint (allow 'publishing' + 'deleted')
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'deleted', 'publishing'));

-- FIX: base_price_cents allow NULL (2-step pricing: create first, set price after cost extraction)
ALTER TABLE products ALTER COLUMN base_price_cents DROP NOT NULL;

-- Backfill: lowercase currency → EUR
UPDATE products SET currency = 'EUR' WHERE lower(currency) = 'usd' AND currency != 'EUR';

-- Cleanup: Mark E2E test products as deleted
UPDATE products SET status = 'deleted' WHERE title LIKE '%[E2E]%' AND status != 'deleted';
