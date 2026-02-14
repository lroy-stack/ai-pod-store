-- Add test products to the products table
-- These are dummy products for testing the conversational storefront

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
  );
