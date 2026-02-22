-- Daily Portfolio Metrics: store-wide daily health snapshot
CREATE TABLE IF NOT EXISTS daily_portfolio_metrics (
  date DATE PRIMARY KEY,
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  aov_cents INTEGER NOT NULL DEFAULT 0,
  gross_margin_pct DOUBLE PRECISION,
  refund_rate_pct DOUBLE PRECISION,
  active_products INTEGER NOT NULL DEFAULT 0,
  zombie_products INTEGER NOT NULL DEFAULT 0,
  new_products_listed INTEGER NOT NULL DEFAULT 0,
  products_delisted INTEGER NOT NULL DEFAULT 0,
  exploration_rate DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_portfolio_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on daily_portfolio_metrics"
  ON daily_portfolio_metrics FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
