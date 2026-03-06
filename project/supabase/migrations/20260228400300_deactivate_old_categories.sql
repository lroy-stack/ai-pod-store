-- SKAPARA Category Restructuring Phase C: Deactivate obsolete categories
-- These categories are not deleted (data preservation) but hidden from the UI

UPDATE public.categories SET is_active = false WHERE slug IN (
  -- Old parents replaced by individual garment types
  'apparel',
  -- Home decor (user doesn't want posters/wall art)
  'home-decor', 'posters', 'wall-art', 'canvas', 'blankets', 'pillows', 'rugs',
  -- Irrelevant categories
  'kitchen', 'kitchen-towels',
  'games', 'puzzles',
  'stationery', 'journals', 'notebooks', 'postcards',
  'sportswear', 'activewear', 'swimwear',
  'jewelry', 'glassware',
  -- Old children migrated to new parents
  'hoodies',       -- → pullover-hoodies under hoodies-sweatshirts
  'sweatshirts',   -- → crewnecks under hoodies-sweatshirts
  'hats',          -- → headwear subcategories
  'tech-accessories', -- → specific subcategories (desk-mats, laptop-sleeves)
  'bottles-tumblers', -- → split into bottles + tumblers
  -- Future categories (reactivate when stock exists)
  'tank-tops', 'outerwear', 'bottoms',
  'bags'
);
