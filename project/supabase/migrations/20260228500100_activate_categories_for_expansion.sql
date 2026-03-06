-- Activate parent categories needed for catalog expansion
UPDATE categories SET is_active = true WHERE slug IN ('kids', 'apparel') AND is_active = false;
