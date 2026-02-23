-- Create categories table with i18n support
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  name_de TEXT NOT NULL,
  icon TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on parent_id for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Create index on slug for lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for active categories
CREATE POLICY "Public can view active categories"
  ON public.categories
  FOR SELECT
  USING (is_active = true);

-- RLS Policy: Service role has full access
CREATE POLICY "Service role has full access to categories"
  ON public.categories
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert 18 categories with i18n names
INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
  -- Top-level categories
  ('apparel', NULL, 'Apparel', 'Ropa', 'Bekleidung', 'shirt', 10, true),
  ('accessories', NULL, 'Accessories', 'Accesorios', 'Zubehör', 'shopping-bag', 20, true),
  ('drinkware', NULL, 'Drinkware', 'Vajilla', 'Trinkgeschirr', 'coffee', 30, true),
  ('home-decor', NULL, 'Home Decor', 'Decoración del Hogar', 'Wohndeko', 'home', 40, true),
  ('kitchen', NULL, 'Kitchen', 'Cocina', 'Küche', 'utensils', 50, true),
  ('kids', NULL, 'Kids', 'Niños', 'Kinder', 'baby', 60, true),
  ('games', NULL, 'Games', 'Juegos', 'Spiele', 'gamepad', 70, true),
  ('stationery', NULL, 'Stationery', 'Papelería', 'Schreibwaren', 'pencil', 80, true);

-- Get parent IDs for sub-categories (will be populated after INSERT)
DO $$
DECLARE
  apparel_id UUID;
  accessories_id UUID;
  drinkware_id UUID;
  home_decor_id UUID;
BEGIN
  -- Get parent category IDs
  SELECT id INTO apparel_id FROM public.categories WHERE slug = 'apparel';
  SELECT id INTO accessories_id FROM public.categories WHERE slug = 'accessories';
  SELECT id INTO drinkware_id FROM public.categories WHERE slug = 'drinkware';
  SELECT id INTO home_decor_id FROM public.categories WHERE slug = 'home-decor';

  -- Insert sub-categories of apparel
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('t-shirts', apparel_id, 'T-Shirts', 'Camisetas', 'T-Shirts', 'shirt', 11, true),
    ('hoodies', apparel_id, 'Hoodies', 'Sudaderas con Capucha', 'Kapuzenpullover', 'shirt', 12, true),
    ('sweatshirts', apparel_id, 'Sweatshirts', 'Sudaderas', 'Sweatshirts', 'shirt', 13, true);

  -- Insert sub-categories of accessories
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('bags', accessories_id, 'Bags', 'Bolsas', 'Taschen', 'shopping-bag', 21, true),
    ('hats', accessories_id, 'Hats', 'Sombreros', 'Hüte', 'crown', 22, true),
    ('phone-cases', accessories_id, 'Phone Cases', 'Fundas de Teléfono', 'Handyhüllen', 'smartphone', 23, true),
    ('stickers', accessories_id, 'Stickers', 'Pegatinas', 'Aufkleber', 'star', 24, true);

  -- Insert sub-category of drinkware
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('mugs', drinkware_id, 'Mugs', 'Tazas', 'Tassen', 'coffee', 31, true);

  -- Insert sub-categories of home-decor
  INSERT INTO public.categories (slug, parent_id, name_en, name_es, name_de, icon, sort_order, is_active) VALUES
    ('posters', home_decor_id, 'Posters', 'Pósteres', 'Poster', 'image', 41, true),
    ('wall-art', home_decor_id, 'Wall Art', 'Arte de Pared', 'Wandkunst', 'palette', 42, true);
END $$;
