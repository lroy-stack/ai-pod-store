-- Fix products whose VARCHAR category field already has the correct subcategory slug
-- but category_id incorrectly points to the parent category.
-- This happens when the original backfill matched the parent instead of the subcategory.

UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = p.category
  AND c.is_active = true
  AND p.category IS NOT NULL
  AND p.category_id IS DISTINCT FROM c.id;
