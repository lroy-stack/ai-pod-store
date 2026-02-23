-- =====================================================
-- SEED DATA FOR LOCAL DEVELOPMENT AND TESTING
-- =====================================================
-- This file contains test/demo data that should NOT be
-- included in production migrations.
--
-- Run with: supabase db seed
--
-- Note: This data is for development and testing only.
-- Production databases should not seed this data.
-- =====================================================

-- =====================================================
-- TEST USER
-- =====================================================
-- Fixed UUID test user for review submissions and testing
INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testuser@podstore.local',
  '$2a$10$rQZ4YXxN5nU5yXHkJxYhPeVYvJ.xz8HWz8mQxqXPKxYzJ5XqwYXKu',
  'Test User',
  'customer',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- MOCK PRODUCTS (with fixed UUIDs)
-- =====================================================
-- Mock products with fixed UUIDs for consistent testing
-- These are referenced by test orders and other test data
INSERT INTO products (
  id,
  printify_id,
  title,
  description,
  category,
  base_price_cents,
  currency,
  images,
  status,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'mock-1',
    'Classic T-Shirt',
    'Comfortable cotton t-shirt perfect for everyday wear. Made from 100% premium cotton with a modern fit.',
    'Apparel',
    2499,
    'usd',
    '[{"url": "https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Front", "alt": "Classic T-Shirt"}]'::jsonb,
    'active',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'mock-2',
    'Hoodie',
    'Cozy fleece hoodie for chilly days',
    'Apparel',
    4999,
    'usd',
    '[{"url": "https://via.placeholder.com/600x600/8b5cf6/ffffff?text=Hoodie+Front", "alt": "Hoodie"}]'::jsonb,
    'active',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'mock-3',
    'Mug',
    'Ceramic coffee mug',
    'Home',
    1499,
    'usd',
    '[{"url": "https://via.placeholder.com/600x600/10b981/ffffff?text=Mug+Front", "alt": "Mug"}]'::jsonb,
    'active',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST PRODUCTS (generated IDs)
-- =====================================================
-- Additional dummy products for testing the conversational storefront
INSERT INTO products (
  title,
  description,
  category,
  tags,
  base_price_cents,
  currency,
  images,
  printify_id,
  status,
  avg_rating,
  review_count
) VALUES
  (
    'Classic Cat T-Shirt',
    'Adorable cat design on a comfortable cotton t-shirt. Perfect for cat lovers!',
    'apparel',
    ARRAY['cat', 't-shirt', 'cats', 'cute', 'apparel'],
    2499,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/3b82f6/ffffff?text=Cat+T-Shirt", "alt": "Classic Cat T-Shirt"}]'::jsonb,
    'printify_12345',
    'active',
    4.5,
    128
  ),
  (
    'Vintage Hoodie',
    'Cozy fleece hoodie with vintage print. Stay warm in style!',
    'apparel',
    ARRAY['hoodie', 'vintage', 'cozy', 'apparel'],
    4999,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/8b5cf6/ffffff?text=Hoodie", "alt": "Vintage Hoodie"}]'::jsonb,
    'printify_12346',
    'active',
    4.8,
    94
  ),
  (
    'Funny Cat Mug',
    'Ceramic coffee mug with hilarious cat design. Start your day with a smile!',
    'home',
    ARRAY['mug', 'cat', 'coffee', 'funny', 'home'],
    1499,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/10b981/ffffff?text=Cat+Mug", "alt": "Funny Cat Mug"}]'::jsonb,
    'printify_12347',
    'active',
    4.3,
    256
  ),
  (
    'Minimalist Cat Poster',
    'High-quality art poster with minimalist cat illustration. Perfect for any room!',
    'home',
    ARRAY['poster', 'cat', 'art', 'minimalist', 'home'],
    1999,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/f59e0b/ffffff?text=Cat+Poster", "alt": "Minimalist Cat Poster"}]'::jsonb,
    'printify_12348',
    'active',
    4.6,
    87
  ),
  (
    'Cat Phone Case',
    'Protective phone case with cute cat design. Keep your phone safe and stylish!',
    'accessories',
    ARRAY['phone case', 'cat', 'accessories', 'cute'],
    1699,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/ef4444/ffffff?text=Cat+Case", "alt": "Cat Phone Case"}]'::jsonb,
    'printify_12349',
    'active',
    4.4,
    312
  ),
  (
    'Dog Lover T-Shirt',
    'Show your love for dogs with this awesome t-shirt design!',
    'apparel',
    ARRAY['dog', 't-shirt', 'dogs', 'apparel'],
    2499,
    'usd',
    '[{"src": "https://via.placeholder.com/800x800/3b82f6/ffffff?text=Dog+T-Shirt", "alt": "Dog Lover T-Shirt"}]'::jsonb,
    'printify_12350',
    'active',
    4.7,
    156
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- TEST ORDER
-- =====================================================
-- Test order with shipped status (eligible for return)
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
  '00000000-0000-0000-0000-000000000001',
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

-- =====================================================
-- TEST ORDER ITEMS
-- =====================================================
-- Add multiple items to test order
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
  rn::int,  -- Different quantity for each item (1, 2, 3)
  CASE rn
    WHEN 1 THEN 1999
    WHEN 2 THEN 1699
    WHEN 3 THEN 1299
  END
FROM first_three_products
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST NOTIFICATIONS
-- =====================================================
-- Insert multiple test notifications for testing notification features
INSERT INTO notifications (
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  notification_type,
  notification_title,
  notification_body,
  FALSE,
  NOW() - (interval '1 hour' * row_num)
FROM (
  VALUES
    (1, 'order_shipped', 'Order #12345 Shipped', 'Your order has been shipped and is on its way!'),
    (2, 'payment_success', 'Payment Received', 'We have received your payment for order #12346.'),
    (3, 'order_delivered', 'Order Delivered', 'Your order #12344 has been delivered to your address.'),
    (4, 'info', 'New Products Added', 'Check out our new collection of t-shirts and phone cases!'),
    (5, 'payment_failed', 'Payment Failed', 'We could not process your payment. Please update your payment method.')
) AS notifications(row_num, notification_type, notification_title, notification_body)
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE user_id = '00000000-0000-0000-0000-000000000001' AND type = notification_type AND title = notification_title
);
