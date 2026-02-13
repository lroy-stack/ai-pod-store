-- Insert mock products for testing (matching the frontend mock data)
-- Using fixed UUIDs so frontend can reference them

INSERT INTO products (id, title, description, base_price_cents, currency, category, status, created_at, updated_at, published_at)
VALUES
  -- Product 1: Classic T-Shirt ($24.99)
  ('00000000-0000-0000-0000-000000000001', 'Classic T-Shirt', 'Comfortable cotton t-shirt perfect for everyday wear. Made from 100% premium cotton with a modern fit.', 2499, 'usd', 'apparel', 'active', NOW(), NOW(), NOW()),

  -- Product 2: Hoodie ($49.99)
  ('00000000-0000-0000-0000-000000000002', 'Hoodie', 'Cozy fleece hoodie for chilly days', 4999, 'usd', 'apparel', 'active', NOW(), NOW(), NOW()),

  -- Product 3: Mug ($14.99)
  ('00000000-0000-0000-0000-000000000003', 'Mug', 'Ceramic coffee mug', 1499, 'usd', 'home', 'active', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
