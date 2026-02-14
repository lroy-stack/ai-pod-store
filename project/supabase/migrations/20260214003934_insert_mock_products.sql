-- Insert mock products to match the frontend mock data

-- Insert products into products table
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
)
VALUES
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
