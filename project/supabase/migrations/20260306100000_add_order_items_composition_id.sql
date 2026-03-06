ALTER TABLE order_items ADD COLUMN IF NOT EXISTS composition_id UUID REFERENCES design_compositions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_composition ON order_items(composition_id) WHERE composition_id IS NOT NULL;
