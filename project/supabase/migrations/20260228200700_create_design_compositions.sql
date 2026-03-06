CREATE TABLE IF NOT EXISTS design_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES design_sessions(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  layers JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_url TEXT,
  production_url TEXT,
  surcharge_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'ordered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
