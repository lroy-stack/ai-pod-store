-- Design templates library — Fabric.js JSON templates for quick-start designs
CREATE TABLE IF NOT EXISTS design_templates_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_es TEXT,
  name_de TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT NOT NULL,
  fabric_json JSONB NOT NULL,
  product_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON design_templates_library(category) WHERE is_active;
