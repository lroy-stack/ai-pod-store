-- Product Daily Metrics: aggregated per-product performance by day
CREATE TABLE IF NOT EXISTS product_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  cart_adds INTEGER NOT NULL DEFAULT 0,
  wishlist_adds INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  cogs_cents INTEGER NOT NULL DEFAULT 0,
  margin_cents INTEGER GENERATED ALWAYS AS (revenue_cents - cogs_cents) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, metric_date)
);

CREATE INDEX idx_pdm_date ON product_daily_metrics(metric_date DESC);
CREATE INDEX idx_pdm_product_date ON product_daily_metrics(product_id, metric_date DESC);

ALTER TABLE product_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on product_daily_metrics"
  ON product_daily_metrics FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
