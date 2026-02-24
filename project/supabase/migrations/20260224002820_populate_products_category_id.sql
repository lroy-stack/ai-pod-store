-- Populate category_id for existing products based on their VARCHAR category field
-- Maps old category values to the new categories table via slug

UPDATE products
SET category_id = (
  SELECT c.id
  FROM categories c
  WHERE c.slug = CASE
    WHEN products.category IN ('apparel', 't-shirts', 'hoodies', 'sweatshirts', 'accessories', 'bags', 'hats', 'phone-cases', 'stickers', 'drinkware', 'mugs', 'home-decor', 'posters', 'wall-art', 'kitchen', 'kids', 'games', 'stationery')
      THEN products.category
    WHEN products.category IN ('home & living', 'home and living', 'home', 'home-living', 'hogar', 'casa')
      THEN 'home-decor'
    WHEN products.category IN ('clothing', 'ropa')
      THEN 'apparel'
    WHEN products.category IN ('cups')
      THEN 'drinkware'
    WHEN products.category = 'uncategorized'
      THEN 'accessories'
    ELSE 'accessories'
  END
  AND c.is_active = true
  LIMIT 1
)
WHERE category_id IS NULL;
