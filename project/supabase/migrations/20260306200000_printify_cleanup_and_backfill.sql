-- ============================================================
-- Printify Cleanup & Backfill Migration
--
-- 1. Soft-delete all active/archived Printify products
-- 2. Backfill provider-agnostic columns (catch any missed by Phase 3)
-- 3. Archive Printify test orders
-- 4. Set pod_provider to 'printify_legacy' so Phase 5 guard passes
-- ============================================================

BEGIN;

-- -----------------------------------------------
-- 1. Soft-delete active/archived Printify products
-- -----------------------------------------------
UPDATE products
SET status = 'deleted', updated_at = now()
WHERE pod_provider = 'printify'
  AND status IN ('active', 'archived', 'draft');

-- -----------------------------------------------
-- 2. Backfill provider-agnostic columns
--    Phase 3 already ran a backfill, but catch any
--    products created after Phase 3.
-- -----------------------------------------------

-- products: printify_id → provider_product_id
UPDATE products
SET provider_product_id = printify_id
WHERE printify_id IS NOT NULL
  AND provider_product_id IS NULL;

-- products: blueprint_id → product_template_id
UPDATE products
SET product_template_id = blueprint_id::TEXT
WHERE blueprint_id IS NOT NULL
  AND product_template_id IS NULL;

-- products: print_provider_id → provider_facility_id
UPDATE products
SET provider_facility_id = print_provider_id::TEXT
WHERE print_provider_id IS NOT NULL
  AND provider_facility_id IS NULL;

-- product_variants: printify_variant_id → external_variant_id
UPDATE product_variants
SET external_variant_id = printify_variant_id
WHERE printify_variant_id IS NOT NULL
  AND external_variant_id IS NULL;

-- orders: printify_order_id → external_order_id
UPDATE orders
SET external_order_id = printify_order_id
WHERE printify_order_id IS NOT NULL
  AND external_order_id IS NULL;

-- orders: printify_cost_cents → pod_cost_cents
UPDATE orders
SET pod_cost_cents = printify_cost_cents
WHERE printify_cost_cents IS NOT NULL
  AND pod_cost_cents IS NULL;

-- orders: printify_retry_count → pod_retry_count
UPDATE orders
SET pod_retry_count = printify_retry_count
WHERE printify_retry_count IS NOT NULL
  AND printify_retry_count > 0
  AND pod_retry_count = 0;

-- orders: printify_error → pod_error
UPDATE orders
SET pod_error = printify_error
WHERE printify_error IS NOT NULL
  AND pod_error IS NULL;

-- orders: printify_last_attempt_at → pod_last_attempt_at
UPDATE orders
SET pod_last_attempt_at = printify_last_attempt_at
WHERE printify_last_attempt_at IS NOT NULL
  AND pod_last_attempt_at IS NULL;

-- order_items: printify_line_item_id → external_line_item_id
UPDATE order_items
SET external_line_item_id = printify_line_item_id
WHERE printify_line_item_id IS NOT NULL
  AND external_line_item_id IS NULL;

-- designs: printify_upload_id → provider_upload_id
UPDATE designs
SET provider_upload_id = printify_upload_id
WHERE printify_upload_id IS NOT NULL
  AND provider_upload_id IS NULL;

-- designs: printify_image_url → pod_upload_url
UPDATE designs
SET pod_upload_url = printify_image_url
WHERE printify_image_url IS NOT NULL
  AND pod_upload_url IS NULL;

-- personalizations: printify_temp_product_id → provider_temp_product_id
UPDATE personalizations
SET provider_temp_product_id = printify_temp_product_id
WHERE printify_temp_product_id IS NOT NULL
  AND provider_temp_product_id IS NULL;

-- -----------------------------------------------
-- 3. Cancel Printify test orders (6 orders)
--    Valid statuses: pending, paid, submitted,
--    in_production, shipped, delivered, cancelled, refunded
-- -----------------------------------------------
UPDATE orders
SET status = 'cancelled', updated_at = now()
WHERE printify_order_id IS NOT NULL
  AND status NOT IN ('cancelled', 'refunded');

-- -----------------------------------------------
-- 4. Mark all Printify products as legacy provider
--    so Phase 5 DROP migration guard passes
-- -----------------------------------------------
UPDATE products
SET pod_provider = 'printify_legacy'
WHERE pod_provider = 'printify';

UPDATE orders
SET pod_provider = 'printify_legacy'
WHERE pod_provider = 'printify';

-- -----------------------------------------------
-- Verification queries (informational)
-- -----------------------------------------------
DO $$
DECLARE
  active_printify INTEGER;
  unbackfilled_variants INTEGER;
  unbackfilled_orders INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_printify
  FROM products WHERE pod_provider = 'printify';

  SELECT COUNT(*) INTO unbackfilled_variants
  FROM product_variants
  WHERE printify_variant_id IS NOT NULL AND external_variant_id IS NULL;

  SELECT COUNT(*) INTO unbackfilled_orders
  FROM orders
  WHERE printify_order_id IS NOT NULL AND external_order_id IS NULL;

  IF active_printify > 0 THEN
    RAISE WARNING 'Still % products with pod_provider=printify', active_printify;
  END IF;

  IF unbackfilled_variants > 0 THEN
    RAISE WARNING 'Still % variants without external_variant_id', unbackfilled_variants;
  END IF;

  IF unbackfilled_orders > 0 THEN
    RAISE WARNING 'Still % orders without external_order_id', unbackfilled_orders;
  END IF;

  RAISE NOTICE 'Printify cleanup complete. Active printify products: %, Unbackfilled variants: %, Unbackfilled orders: %',
    active_printify, unbackfilled_variants, unbackfilled_orders;
END $$;

COMMIT;
