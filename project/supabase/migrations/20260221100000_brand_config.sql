-- Brand configuration table for neck labels, packaging, and brand identity
-- Used by Brand Manager agent and create-product pipeline

CREATE TABLE IF NOT EXISTS brand_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neck_label_image_id TEXT,
  neck_label_preview_url TEXT,
  packaging_insert_enabled BOOLEAN DEFAULT FALSE,
  packaging_insert_text TEXT,
  gift_messages_enabled BOOLEAN DEFAULT FALSE,
  brand_color_primary TEXT DEFAULT '#000000',
  brand_color_secondary TEXT DEFAULT '#FFFFFF',
  brand_font TEXT DEFAULT 'Inter',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE brand_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON brand_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read active config" ON brand_config
  FOR SELECT USING (is_active = true);

-- Insert default row
INSERT INTO brand_config (
  neck_label_image_id,
  packaging_insert_enabled,
  gift_messages_enabled,
  brand_color_primary,
  brand_color_secondary,
  brand_font,
  is_active
) VALUES (
  NULL,
  FALSE,
  TRUE,
  '#000000',
  '#FFFFFF',
  'Inter',
  TRUE
);
