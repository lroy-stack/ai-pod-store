-- Seed approved product reviews for testimonials section
-- Uses existing test user, products, and orders from previous migrations

-- Create 6 approved reviews in English for the testimonials section
INSERT INTO product_reviews (
  id,
  product_id,
  user_id,
  order_id,
  rating,
  title,
  body,
  is_verified_purchase,
  moderation_status,
  locale,
  created_at
)
SELECT
  gen_random_uuid(),
  p.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  o.id,
  rating_val,
  title_val,
  body_val,
  true,
  'approved',
  'en',
  NOW() - (row_num || ' days')::interval
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM products
  WHERE status = 'active'
  LIMIT 6
) p
CROSS JOIN LATERAL (
  SELECT id
  FROM orders
  WHERE status = 'paid'
  LIMIT 1
) o
CROSS JOIN LATERAL (
  VALUES
    (1, 5, 'Absolutely love it!', 'The quality is amazing and the design is exactly what I was looking for. Shipped quickly and arrived in perfect condition.'),
    (2, 5, 'Best purchase this year', 'I was skeptical at first but this exceeded all my expectations. The AI really understood what I wanted and created something unique.'),
    (3, 4, 'Great quality, fast delivery', 'Very happy with my purchase. The product looks great and feels durable. Only minor issue was the sizing ran a bit small.'),
    (4, 5, 'Highly recommend!', 'This is my third order and I keep coming back because the quality is consistently excellent. Customer service is top-notch too.'),
    (5, 5, 'Perfect gift idea', 'Bought this as a gift and it was a huge hit! The personalization options made it special. Will definitely order again.'),
    (6, 4, 'Solid product', 'Good quality for the price. The design process was fun and easy. Delivery took a bit longer than expected but worth the wait.')
) AS reviews(row_num, rating_val, title_val, body_val)
WHERE p.rn = reviews.row_num;
