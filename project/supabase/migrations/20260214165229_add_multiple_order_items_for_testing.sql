-- Add multiple items to test order for feature #200
-- Tests that order detail page displays multiple items correctly

-- First, clear any existing items for this test order
DELETE FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000100';

-- Insert 3 items using the first 3 products/variants available
WITH first_three_products AS (
  SELECT p.id as product_id, pv.id as variant_id, ROW_NUMBER() OVER (ORDER BY p.created_at) as rn
  FROM products p
  JOIN product_variants pv ON pv.product_id = p.id
  WHERE p.is_active = true
  LIMIT 3
)
INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
SELECT 
  '00000000-0000-0000-0000-000000000100',
  product_id,
  variant_id,
  rn,  -- Different quantity for each item (1, 2, 3)
  CASE rn
    WHEN 1 THEN 1999
    WHEN 2 THEN 1699
    WHEN 3 THEN 1299
  END
FROM first_three_products;
