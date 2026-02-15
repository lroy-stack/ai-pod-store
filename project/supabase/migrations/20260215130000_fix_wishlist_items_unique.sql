-- Fix: UNIQUE(wishlist_id, product_id, variant_id) does not prevent duplicates
-- when variant_id IS NULL (PostgreSQL treats NULLs as distinct in UNIQUE).

-- Step 1: Clean up existing duplicates (keep the oldest)
DELETE FROM wishlist_items a
USING wishlist_items b
WHERE a.wishlist_id = b.wishlist_id
  AND a.product_id = b.product_id
  AND a.variant_id IS NULL
  AND b.variant_id IS NULL
  AND a.added_at > b.added_at;

-- Step 2: Create partial unique index for the NULL variant_id case
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_items_no_variant
  ON wishlist_items (wishlist_id, product_id)
  WHERE variant_id IS NULL;
