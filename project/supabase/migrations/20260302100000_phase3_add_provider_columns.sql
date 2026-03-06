-- ============================================================
-- Phase 3: Add provider-agnostic columns to products,
-- product_variants, orders, order_items, designs, and
-- personalizations.
-- All old Printify columns are preserved — no data is dropped.
-- Backfill copies existing Printify IDs into the new columns.
-- ============================================================

BEGIN;

-- -----------------------------------------------
-- products: add pod_provider + provider_product_id
-- -----------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pod_provider          VARCHAR(20) NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS provider_product_id   TEXT,
  ADD COLUMN IF NOT EXISTS product_template_id   TEXT,
  ADD COLUMN IF NOT EXISTS provider_facility_id  TEXT;

-- Backfill from existing Printify columns
UPDATE products
SET
  provider_product_id  = printify_id,
  product_template_id  = blueprint_id::TEXT,
  provider_facility_id = print_provider_id::TEXT
WHERE printify_id IS NOT NULL;

-- Partial unique index on (pod_provider, provider_product_id)
-- so the upsert pattern works regardless of provider.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_provider_product_unique
  ON products (pod_provider, provider_product_id)
  WHERE provider_product_id IS NOT NULL;

-- Composite lookup index for provider + status filtering
CREATE INDEX IF NOT EXISTS idx_products_pod_provider
  ON products (pod_provider, status);

-- -----------------------------------------------
-- product_variants: add external_variant_id
-- -----------------------------------------------
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_variant_id TEXT;

-- Backfill
UPDATE product_variants
SET external_variant_id = printify_variant_id
WHERE printify_variant_id IS NOT NULL;

-- Unique constraint for upsert: (product_id, external_variant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_provider_variant_unique'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_provider_variant_unique
      UNIQUE (product_id, external_variant_id);
  END IF;
END $$;

-- -----------------------------------------------
-- orders: add external_order_id + pod_* columns
-- -----------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS pod_provider         VARCHAR(20) NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS pod_cost_cents       INTEGER,
  ADD COLUMN IF NOT EXISTS pod_retry_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pod_error            TEXT,
  ADD COLUMN IF NOT EXISTS pod_last_attempt_at  TIMESTAMPTZ;

-- Backfill
UPDATE orders
SET
  external_order_id   = printify_order_id,
  pod_cost_cents      = printify_cost_cents,
  pod_retry_count     = printify_retry_count,
  pod_error           = printify_error,
  pod_last_attempt_at = printify_last_attempt_at
WHERE printify_order_id IS NOT NULL
   OR printify_cost_cents IS NOT NULL
   OR printify_retry_count > 0;

-- Index for retry-queue logic (mirrors idx_orders_printify_retry)
CREATE INDEX IF NOT EXISTS idx_orders_pod_retry
  ON orders (pod_retry_count, pod_last_attempt_at)
  WHERE pod_error IS NOT NULL AND status = 'paid';

-- Index for webhook lookups by external_order_id
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id
  ON orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

-- -----------------------------------------------
-- order_items: add external_line_item_id
-- -----------------------------------------------
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS external_line_item_id TEXT;

-- Backfill
UPDATE order_items
SET external_line_item_id = printify_line_item_id
WHERE printify_line_item_id IS NOT NULL;

-- -----------------------------------------------
-- designs: add provider_upload_id + pod_upload_url
-- -----------------------------------------------
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS provider_upload_id TEXT,
  ADD COLUMN IF NOT EXISTS pod_upload_url     TEXT;

-- Backfill (printify_upload_id → provider_upload_id)
UPDATE designs
SET provider_upload_id = printify_upload_id
WHERE printify_upload_id IS NOT NULL;

-- Backfill (printify_image_url → pod_upload_url)
UPDATE designs
SET pod_upload_url = printify_image_url
WHERE printify_image_url IS NOT NULL;

-- -----------------------------------------------
-- personalizations: add provider_temp_product_id
-- -----------------------------------------------
ALTER TABLE personalizations
  ADD COLUMN IF NOT EXISTS provider_temp_product_id TEXT;

-- Backfill
UPDATE personalizations
SET provider_temp_product_id = printify_temp_product_id
WHERE printify_temp_product_id IS NOT NULL;

COMMIT;
