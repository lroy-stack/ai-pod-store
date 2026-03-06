ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS composition_id UUID REFERENCES design_compositions(id);
