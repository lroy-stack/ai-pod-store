-- Expand category tree to match Printify EU catalog
-- Adds ~20 new subcategories and 1 new parent (sportswear)

-- Rename "Apparel" → "Clothing" for clarity
UPDATE public.categories
SET name_en = 'Clothing', name_es = 'Ropa', name_de = 'Kleidung'
WHERE slug = 'apparel';

-- Insert new parent: Sportswear
INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active)
VALUES ('sportswear', NULL, 'Sportswear', 'Ropa Deportiva', 'Sportbekleidung', 'dumbbell', 45, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert new subcategories using DO block to look up parent IDs
DO $$
DECLARE
  apparel_id UUID;
  sportswear_id UUID;
  kids_id UUID;
  accessories_id UUID;
  home_decor_id UUID;
  drinkware_id UUID;
  kitchen_id UUID;
  stationery_id UUID;
  games_id UUID;
BEGIN
  SELECT id INTO apparel_id FROM public.categories WHERE slug = 'apparel';
  SELECT id INTO sportswear_id FROM public.categories WHERE slug = 'sportswear';
  SELECT id INTO kids_id FROM public.categories WHERE slug = 'kids';
  SELECT id INTO accessories_id FROM public.categories WHERE slug = 'accessories';
  SELECT id INTO home_decor_id FROM public.categories WHERE slug = 'home-decor';
  SELECT id INTO drinkware_id FROM public.categories WHERE slug = 'drinkware';
  SELECT id INTO kitchen_id FROM public.categories WHERE slug = 'kitchen';
  SELECT id INTO stationery_id FROM public.categories WHERE slug = 'stationery';
  SELECT id INTO games_id FROM public.categories WHERE slug = 'games';

  -- Apparel (Clothing) new subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('long-sleeves', apparel_id, 'Long Sleeves', 'Manga Larga', 'Langarmshirts', 'shirt', 14, true),
    ('tank-tops', apparel_id, 'Tank Tops', 'Camisetas sin Mangas', 'Tanktops', 'shirt', 15, true),
    ('outerwear', apparel_id, 'Outerwear', 'Abrigos', 'Oberbekleidung', 'shirt', 16, true),
    ('bottoms', apparel_id, 'Bottoms', 'Pantalones', 'Hosen', 'shirt', 17, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Sportswear subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('activewear', sportswear_id, 'Activewear', 'Ropa Activa', 'Aktivbekleidung', 'dumbbell', 46, true),
    ('swimwear', sportswear_id, 'Swimwear', 'Bañadores', 'Badebekleidung', 'waves', 47, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Kids subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('kids-tshirts', kids_id, 'Kids T-Shirts', 'Camisetas Niños', 'Kinder T-Shirts', 'baby', 61, true),
    ('kids-sweatshirts', kids_id, 'Kids Sweatshirts', 'Sudaderas Niños', 'Kinder Sweatshirts', 'baby', 62, true),
    ('baby-clothing', kids_id, 'Baby Clothing', 'Ropa de Bebé', 'Babybekleidung', 'baby', 63, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Accessories new subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('jewelry', accessories_id, 'Jewelry', 'Joyería', 'Schmuck', 'gem', 25, true),
    ('socks', accessories_id, 'Socks', 'Calcetines', 'Socken', 'footprints', 26, true),
    ('mouse-pads', accessories_id, 'Mouse Pads', 'Alfombrillas de Ratón', 'Mauspads', 'mouse', 27, true),
    ('tech-accessories', accessories_id, 'Tech Accessories', 'Accesorios Tech', 'Tech-Zubehör', 'smartphone', 28, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Home Decor new subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('canvas', home_decor_id, 'Canvas', 'Lienzos', 'Leinwände', 'image', 43, true),
    ('blankets', home_decor_id, 'Blankets', 'Mantas', 'Decken', 'bed', 44, true),
    ('pillows', home_decor_id, 'Pillows', 'Cojines', 'Kissen', 'bed', 45, true),
    ('rugs', home_decor_id, 'Rugs & Mats', 'Alfombras', 'Teppiche', 'grid', 46, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Drinkware new subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('bottles-tumblers', drinkware_id, 'Bottles & Tumblers', 'Botellas y Vasos', 'Flaschen & Becher', 'cup-soda', 32, true),
    ('glassware', drinkware_id, 'Glassware', 'Cristalería', 'Glaswaren', 'wine', 33, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Kitchen subcategory
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('kitchen-towels', kitchen_id, 'Kitchen Towels', 'Paños de Cocina', 'Geschirrtücher', 'utensils', 51, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Stationery subcategories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('journals', stationery_id, 'Journals', 'Diarios', 'Tagebücher', 'book', 81, true),
    ('notebooks', stationery_id, 'Notebooks', 'Cuadernos', 'Notizbücher', 'book-open', 82, true),
    ('postcards', stationery_id, 'Postcards', 'Postales', 'Postkarten', 'mail', 83, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Games subcategory
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('puzzles', games_id, 'Puzzles', 'Puzzles', 'Puzzles', 'puzzle', 71, true)
  ON CONFLICT (slug) DO NOTHING;
END $$;
