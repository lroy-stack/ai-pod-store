-- Product Beliefs: Bayesian scoring for product lifecycle management
CREATE TABLE IF NOT EXISTS product_beliefs (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  alpha DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  beta DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  views_total INTEGER NOT NULL DEFAULT 0,
  sales_total INTEGER NOT NULL DEFAULT 0,
  revenue_total_cents INTEGER NOT NULL DEFAULT 0,
  cogs_total_cents INTEGER NOT NULL DEFAULT 0,
  sprt_log_lr DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  sprt_decision TEXT NOT NULL DEFAULT 'continue' CHECK (sprt_decision IN ('continue', 'viable', 'not_viable')),
  lifecycle_status TEXT NOT NULL DEFAULT 'observation' CHECK (lifecycle_status IN ('observation', 'promote', 'scale', 'delist', 'archive')),
  last_sale_at TIMESTAMPTZ,
  listed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_beliefs_lifecycle ON product_beliefs(lifecycle_status);
CREATE INDEX idx_product_beliefs_updated ON product_beliefs(updated_at DESC);

-- Auto-create belief row when product is inserted
CREATE OR REPLACE FUNCTION create_product_belief()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_beliefs (product_id, listed_at)
  VALUES (NEW.id, COALESCE(NEW.published_at, NOW()))
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_create_belief
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION create_product_belief();

-- RLS: service role only
ALTER TABLE product_beliefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on product_beliefs"
  ON product_beliefs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
