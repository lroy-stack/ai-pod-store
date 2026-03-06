CREATE INDEX IF NOT EXISTS idx_cart_items_composition ON cart_items(composition_id) WHERE composition_id IS NOT NULL;
