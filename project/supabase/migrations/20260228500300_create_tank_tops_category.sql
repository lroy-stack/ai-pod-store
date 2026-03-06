-- Create tank-tops subcategory under apparel
INSERT INTO categories (slug, name_en, name_es, name_de, parent_id, is_active, sort_order)
SELECT 'tank-tops', 'Tank Tops', 'Camisetas sin Mangas', 'Tanktops', p.id, true, 14
FROM categories p WHERE p.slug = 'apparel'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'tank-tops');
