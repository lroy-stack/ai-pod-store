-- SKAPARA Category Restructuring Phase A: New subcategories
-- Creates subcategories for: hoodies-sweatshirts, headwear, drinkware split, accessories detail, shoes

DO $$
DECLARE
  hs_id UUID;
  hw_id UUID;
  dk_id UUID;
  ac_id UUID;
  sh_id UUID;
BEGIN
  SELECT id INTO hs_id FROM public.categories WHERE slug = 'hoodies-sweatshirts';
  SELECT id INTO hw_id FROM public.categories WHERE slug = 'headwear';
  SELECT id INTO dk_id FROM public.categories WHERE slug = 'drinkware';
  SELECT id INTO ac_id FROM public.categories WHERE slug = 'accessories';
  SELECT id INTO sh_id FROM public.categories WHERE slug = 'shoes';

  -- Hoodies & Sweatshirts subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('pullover-hoodies', hs_id, 'Pullover Hoodies', 'Sudaderas con Capucha', 'Kapuzenpullover', 'shirt', 1, true),
    ('zip-hoodies', hs_id, 'Zip-Up Hoodies', 'Sudaderas con Cremallera', 'Zip-Kapuzenpullover', 'shirt', 2, true),
    ('crewnecks', hs_id, 'Crewneck Sweatshirts', 'Sudaderas Cuello Redondo', 'Rundhals-Sweatshirts', 'shirt', 3, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Headwear subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('caps', hw_id, 'Caps', 'Gorras', 'Kappen', 'crown', 1, true),
    ('snapbacks', hw_id, 'Snapbacks', 'Snapbacks', 'Snapbacks', 'crown', 2, true),
    ('dad-hats', hw_id, 'Dad Hats', 'Gorras Dad', 'Dad Hats', 'crown', 3, true),
    ('5-panel-caps', hw_id, '5-Panel Caps', 'Gorras 5 Paneles', '5-Panel-Kappen', 'crown', 4, true),
    ('beanies', hw_id, 'Beanies', 'Gorros', 'Mützen', 'crown', 5, true),
    ('bucket-hats', hw_id, 'Bucket Hats', 'Sombreros de Pescador', 'Fischerhüte', 'crown', 6, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Drinkware: split bottles-tumblers into separate subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('bottles', dk_id, 'Bottles', 'Botellas', 'Flaschen', 'cup-soda', 31, true),
    ('tumblers', dk_id, 'Tumblers', 'Vasos Térmicos', 'Thermobecher', 'cup-soda', 32, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Accessories: new specific subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('desk-mats', ac_id, 'Desk Mats', 'Alfombrillas Gaming', 'Schreibtischmatten', 'monitor', 28, true),
    ('laptop-sleeves', ac_id, 'Laptop Sleeves', 'Fundas de Portátil', 'Laptophüllen', 'laptop', 29, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Shoes: sneakers (hidden)
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('sneakers', sh_id, 'Sneakers', 'Sneakers', 'Sneakers', 'footprints', 1, false)
  ON CONFLICT (slug) DO NOTHING;
END $$;
