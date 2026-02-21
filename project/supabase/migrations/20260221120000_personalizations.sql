-- Personalizations table: stores customer text/image customizations for products
-- Each personalization creates a one-off Printify product with modified print_areas

CREATE TABLE IF NOT EXISTS personalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  text_content TEXT,
  font_family TEXT DEFAULT 'Inter',
  font_color TEXT DEFAULT '#000000',
  image_url TEXT,
  image_position JSONB DEFAULT '{"x": 0.5, "y": 0.5, "scale": 1, "angle": 0}',
  printify_temp_product_id TEXT,
  preview_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'ordered', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_personalizations_user ON personalizations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_personalizations_product ON personalizations(product_id);
CREATE INDEX idx_personalizations_status ON personalizations(status);

-- RLS
ALTER TABLE personalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personalizations" ON personalizations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create personalizations" ON personalizations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personalizations" ON personalizations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON personalizations
  FOR ALL USING (auth.role() = 'service_role');
