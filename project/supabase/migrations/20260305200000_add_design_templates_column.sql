-- Add design_templates JSONB column to products table.
-- Stores Printful ghost template data for Design Studio:
-- ghost image URLs, print area coordinates, variant-to-template mapping.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS design_templates JSONB;

COMMENT ON COLUMN products.design_templates IS 'Printful mockup-generator templates: ghost images, print area coords, variant mapping';
