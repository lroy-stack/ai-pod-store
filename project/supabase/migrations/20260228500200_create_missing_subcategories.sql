-- Create missing subcategories for catalog expansion
-- Only insert if they don't already exist (idempotent)

INSERT INTO categories (slug, name_en, name_es, name_de, parent_id, is_active, sort_order)
SELECT 'tote-bags', 'Tote Bags', 'Bolsas Tote', 'Tragetaschen', p.id, true, 30
FROM categories p WHERE p.slug = 'accessories'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'tote-bags');
