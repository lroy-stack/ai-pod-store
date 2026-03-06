-- Product labels for badges (trending, bestseller, new, sale, limited)
-- Managed by PodClaw agents or admin. Public read, service-role write.

CREATE TABLE IF NOT EXISTS product_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label_type VARCHAR(50) NOT NULL CHECK (label_type IN ('trending', 'bestseller', 'new', 'sale', 'limited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, label_type)
);

CREATE INDEX IF NOT EXISTS idx_product_labels_product_id ON product_labels(product_id);
CREATE INDEX IF NOT EXISTS idx_product_labels_type ON product_labels(label_type);

ALTER TABLE product_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON product_labels
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read labels" ON product_labels
  FOR SELECT USING (true);
