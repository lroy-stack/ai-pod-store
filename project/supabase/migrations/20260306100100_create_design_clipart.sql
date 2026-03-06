-- Design clipart library — SVG assets for adding to designs
CREATE TABLE IF NOT EXISTS design_clipart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_es TEXT,
  name_de TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  svg_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clipart_category ON design_clipart(category) WHERE is_active;
