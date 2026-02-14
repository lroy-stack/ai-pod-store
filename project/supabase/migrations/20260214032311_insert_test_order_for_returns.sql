-- Insert test order for return flow testing
-- This order will be used to test the return/refund functionality

-- Insert a test order with shipped status (eligible for return)
INSERT INTO orders (
  id,
  user_id,
  stripe_session_id,
  status,
  total_cents,
  currency,
  shipping_address,
  customer_email,
  locale,
  created_at,
  paid_at,
  shipped_at
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  (SELECT id FROM users LIMIT 1),
  'test_session_for_returns_001',
  'shipped',
  4999,
  'usd',
  '{"full_name": "Test User", "street_line1": "123 Test St", "city": "Test City", "state": "CA", "postal_code": "90210", "country_code": "US"}'::jsonb,
  'test@example.com',
  'en',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- Insert order items for the test order
INSERT INTO order_items (
  order_id,
  product_id,
  variant_id,
  quantity,
  unit_price_cents
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM product_variants WHERE product_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  2,
  2499
)
ON CONFLICT (id) DO NOTHING;
