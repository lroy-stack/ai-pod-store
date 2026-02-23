-- Seed 18 product categories with i18n names
INSERT INTO categories (slug, name_en, name_es, name_de, sort_order, is_active) VALUES
  ('apparel', 'Apparel', 'Ropa', 'Bekleidung', 1, true),
  ('home-decor', 'Home & Living', 'Hogar y Decoración', 'Haus & Wohnen', 2, true),
  ('drinkware', 'Drinkware', 'Tazas y Vasos', 'Trinkgefäße', 3, true),
  ('accessories', 'Accessories', 'Accesorios', 'Zubehör', 4, true),
  ('t-shirts', 'T-Shirts', 'Camisetas', 'T-Shirts', 5, true),
  ('hoodies', 'Hoodies', 'Sudaderas', 'Hoodies', 6, true),
  ('stickers', 'Stickers', 'Pegatinas', 'Aufkleber', 7, true),
  ('phone-cases', 'Phone Cases', 'Fundas de Móvil', 'Handyhüllen', 8, true),
  ('posters', 'Posters', 'Pósters', 'Poster', 9, true),
  ('bags', 'Bags', 'Bolsas', 'Taschen', 10, true),
  ('hats', 'Hats', 'Gorras', 'Mützen', 11, true),
  ('mugs', 'Mugs', 'Tazas', 'Tassen', 12, true),
  ('wall-art', 'Wall Art', 'Arte Mural', 'Wandkunst', 13, true),
  ('stationery', 'Stationery', 'Papelería', 'Schreibwaren', 14, true),
  ('sweatshirts', 'Sweatshirts', 'Sudaderas sin Capucha', 'Sweatshirts', 15, true),
  ('kitchen', 'Kitchen', 'Cocina', 'Küche', 16, true),
  ('kids', 'Kids', 'Niños', 'Kinder', 17, true),
  ('games', 'Games', 'Juegos', 'Spiele', 18, true)
ON CONFLICT (slug) DO NOTHING;
