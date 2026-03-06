-- Add partial index for efficient product counting by category
CREATE INDEX IF NOT EXISTS idx_products_category_id_status
  ON products(category_id) WHERE status = 'active';
