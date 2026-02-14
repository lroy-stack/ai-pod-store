-- Add 2 more items to test order (already has 1)
-- Tests that order detail page displays multiple items correctly

-- Insert 2 more items using products 2 and 3
WITH next_two_products AS (
  SELECT 
    p.id as product_id,
    pv.id as variant_id,
    ROW_NUMBER() OVER (ORDER BY p.created_at) as rn
  FROM products p
  JOIN product_variants pv ON pv.product_id = p.id
  OFFSET 1 LIMIT 2
)
INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
SELECT 
  '00000000-0000-0000-0000-000000000100'::uuid,
  product_id,
  variant_id,
  (rn + 1)::integer,
  (CASE WHEN rn = 1 THEN 1699 ELSE 1299 END)::integer
FROM next_two_products;
