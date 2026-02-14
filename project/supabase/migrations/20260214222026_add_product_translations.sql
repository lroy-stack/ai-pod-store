-- Add translations column to products table for multilingual support
ALTER TABLE products
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.translations IS 'Translations for title and description in different locales. Format: {"es": {"title": "...", "description": "..."}, "de": {"title": "...", "description": "..."}}';

-- Update existing products with sample translations for popular products
UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Camiseta Clásica',
    'description', 'Una camiseta clásica cómoda perfecta para el uso diario'
  ),
  'de', jsonb_build_object(
    'title', 'Klassisches T-Shirt',
    'description', 'Ein bequemes klassisches T-Shirt perfekt für den Alltag'
  )
)
WHERE title = 'Classic T-Shirt';

UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Sudadera Vintage',
    'description', 'Sudadera vintage acogedora con estilo retro'
  ),
  'de', jsonb_build_object(
    'title', 'Vintage Hoodie',
    'description', 'Gemütlicher Vintage-Hoodie mit Retro-Stil'
  )
)
WHERE title = 'Vintage Hoodie';

UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Taza de Gato Divertida',
    'description', 'Taza de café de cerámica con diseño de gato divertido'
  ),
  'de', jsonb_build_object(
    'title', 'Lustige Katzen-Tasse',
    'description', 'Keramik-Kaffeetasse mit lustigem Katzendesign'
  )
)
WHERE title = 'Funny Cat Mug';

UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Camiseta Dog Lover',
    'description', 'Muestra tu amor por los perros con esta genial camiseta'
  ),
  'de', jsonb_build_object(
    'title', 'Hundeliebhaber T-Shirt',
    'description', 'Zeigen Sie Ihre Liebe zu Hunden mit diesem coolen T-Shirt'
  )
)
WHERE title = 'Dog Lover T-Shirt';

UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Póster Minimalista de Gato',
    'description', 'Póster de arte de alta calidad con diseño minimalista de gato'
  ),
  'de', jsonb_build_object(
    'title', 'Minimalistisches Katzen-Poster',
    'description', 'Hochwertiges Kunstposter mit minimalistischem Katzendesign'
  )
)
WHERE title = 'Minimalist Cat Poster';

UPDATE products SET translations = jsonb_build_object(
  'es', jsonb_build_object(
    'title', 'Bolsa Tote',
    'description', 'Bolsa tote ecológica perfecta para compras diarias'
  ),
  'de', jsonb_build_object(
    'title', 'Tragetasche',
    'description', 'Umweltfreundliche Tragetasche perfekt für den täglichen Einkauf'
  )
)
WHERE title = 'Tote Bag';
