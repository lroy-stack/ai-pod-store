-- Add Printify variant IDs to existing product variants
-- This allows testing of the Printify order submission flow

INSERT INTO product_variants (
  product_id,
  printify_variant_id,
  title,
  size,
  color,
  price_cents,
  sku,
  is_enabled,
  is_available
)
VALUES
  -- Classic T-Shirt variants
  ('00000000-0000-0000-0000-000000000001', '12345', 'Classic T-Shirt - S - Black', 'S', 'Black', 2499, 'TSH-BLK-S', true, true),
  ('00000000-0000-0000-0000-000000000001', '12346', 'Classic T-Shirt - M - Black', 'M', 'Black', 2499, 'TSH-BLK-M', true, true),
  ('00000000-0000-0000-0000-000000000001', '12347', 'Classic T-Shirt - L - Black', 'L', 'Black', 2499, 'TSH-BLK-L', true, true),
  ('00000000-0000-0000-0000-000000000001', '12348', 'Classic T-Shirt - S - White', 'S', 'White', 2499, 'TSH-WHT-S', true, true),
  ('00000000-0000-0000-0000-000000000001', '12349', 'Classic T-Shirt - M - White', 'M', 'White', 2499, 'TSH-WHT-M', true, true),

  -- Hoodie variants
  ('00000000-0000-0000-0000-000000000002', '23456', 'Hoodie - S - Navy', 'S', 'Navy', 4999, 'HOD-NAV-S', true, true),
  ('00000000-0000-0000-0000-000000000002', '23457', 'Hoodie - M - Navy', 'M', 'Navy', 4999, 'HOD-NAV-M', true, true),
  ('00000000-0000-0000-0000-000000000002', '23458', 'Hoodie - L - Navy', 'L', 'Navy', 4999, 'HOD-NAV-L', true, true),

  -- Mug variants
  ('00000000-0000-0000-0000-000000000003', '34567', 'Mug - 11oz - White', '11oz', 'White', 1499, 'MUG-WHT-11', true, true),
  ('00000000-0000-0000-0000-000000000003', '34568', 'Mug - 15oz - White', '15oz', 'White', 1699, 'MUG-WHT-15', true, true)
ON CONFLICT DO NOTHING;
