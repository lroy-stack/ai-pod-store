-- SKAPARA Category Restructuring Phase A: New parent categories + promote existing
-- Creates: hoodies-sweatshirts, headwear, shoes (top-level)
-- Promotes: t-shirts, long-sleeves from apparel children to top-level

DO $$
BEGIN
  -- Create new top-level parent: Hoodies & Sweatshirts
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active)
  VALUES ('hoodies-sweatshirts', NULL, 'Hoodies & Sweatshirts', 'Sudaderas', 'Kapuzenpullover & Sweatshirts', 'shirt', 12, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Create new top-level parent: Headwear
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active)
  VALUES ('headwear', NULL, 'Headwear', 'Gorras y Gorros', 'Kopfbedeckungen', 'crown', 14, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Create new top-level parent: Shoes (hidden until stock)
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active)
  VALUES ('shoes', NULL, 'Shoes', 'Zapatillas', 'Schuhe', 'footprints', 80, false)
  ON CONFLICT (slug) DO NOTHING;

  -- Promote t-shirts to top-level (was child of apparel)
  UPDATE public.categories
  SET parent_id = NULL, sort_order = 10, name_en = 'T-Shirts', name_es = 'Camisetas', name_de = 'T-Shirts'
  WHERE slug = 't-shirts';

  -- Promote long-sleeves to top-level (was child of apparel)
  UPDATE public.categories
  SET parent_id = NULL, sort_order = 13, name_en = 'Long Sleeves', name_es = 'Camisetas Manga Larga', name_de = 'Langarmshirts'
  WHERE slug = 'long-sleeves';

  -- Update drinkware sort order to fit new hierarchy
  UPDATE public.categories SET sort_order = 30 WHERE slug = 'drinkware';

  -- Update accessories sort order
  UPDATE public.categories SET sort_order = 40 WHERE slug = 'accessories';

  -- Update kids sort order + hide until stock
  UPDATE public.categories SET sort_order = 70, is_active = false WHERE slug = 'kids';
END $$;
