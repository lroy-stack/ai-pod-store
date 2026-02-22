-- Migration: Enforce variant_id NOT NULL on cart_items and order_items
--
-- Context: variant_id was nullable, allowing orders to reach Printify with
-- variant_id=0 (fallback), which Printify rejects silently. Every published
-- product always has ≥1 variant (Printify guarantee + quality gate hook).
-- This migration establishes the invariant at the database level.

-- ============================================================
-- PART 1: order_items — backfill + NOT NULL + FK RESTRICT
-- ============================================================

-- 1a. Backfill: assign first enabled variant to order_items with NULL variant_id
UPDATE order_items oi
SET variant_id = (
  SELECT pv.id FROM product_variants pv
  WHERE pv.product_id = oi.product_id
    AND pv.is_enabled = true
  ORDER BY pv.price_cents ASC
  LIMIT 1
)
WHERE oi.variant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = oi.product_id AND pv.is_enabled = true
  );

-- 1b. Remove orphan order_items that have no product with variants (test data)
DELETE FROM order_items
WHERE variant_id IS NULL;

-- 1c. Enforce NOT NULL
ALTER TABLE order_items
  ALTER COLUMN variant_id SET NOT NULL;

-- 1d. Change FK to RESTRICT (prevent deleting variants that have orders)
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;

-- ============================================================
-- PART 2: cart_items — cleanup + NOT NULL + FK CASCADE
-- ============================================================

-- 2a. Remove cart_items with NULL variant_id (incomplete items, can't checkout)
DELETE FROM cart_items WHERE variant_id IS NULL;

-- 2b. Enforce NOT NULL
ALTER TABLE cart_items
  ALTER COLUMN variant_id SET NOT NULL;

-- 2c. Change FK from SET NULL to CASCADE (variant deleted → cart item removed)
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_variant_id_fkey;
ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

-- 2d. Replace unique indexes — remove COALESCE workaround (variant_id is now NOT NULL)
DROP INDEX IF EXISTS idx_cart_items_unique_session_product_variant;
DROP INDEX IF EXISTS idx_cart_items_unique_user_product_variant;

CREATE UNIQUE INDEX idx_cart_items_unique_session_product_variant
  ON cart_items(session_id, product_id, variant_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL;

CREATE UNIQUE INDEX idx_cart_items_unique_user_product_variant
  ON cart_items(user_id, product_id, variant_id)
  WHERE user_id IS NOT NULL;
