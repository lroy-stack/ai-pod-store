-- Add unique constraint on (product_id, printify_variant_id) to enable UPSERT pattern
-- This prevents race conditions when syncing variants from Printify webhooks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_product_printify_unique'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_product_printify_unique
      UNIQUE (product_id, printify_variant_id);
  END IF;
END $$;
