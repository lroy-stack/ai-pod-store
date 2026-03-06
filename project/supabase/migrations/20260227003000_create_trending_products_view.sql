-- Materialized view: trending products aggregated from product_daily_metrics (7-day window)
-- Depends on: products, product_daily_metrics (migration 20260222100001)
-- Refresh: CONCURRENTLY every hour via cron or PodClaw agent

CREATE MATERIALIZED VIEW IF NOT EXISTS trending_products AS
  SELECT
    p.id,
    p.title,
    p.avg_rating,
    COALESCE(SUM(pdm.views), 0)::INTEGER AS views_7d,
    COALESCE(SUM(pdm.orders), 0)::INTEGER AS orders_7d,
    (COALESCE(SUM(pdm.views), 0) * 0.3 + COALESCE(SUM(pdm.orders), 0) * 0.7) AS weighted_score
  FROM products p
  LEFT JOIN product_daily_metrics pdm ON p.id = pdm.product_id
    AND pdm.metric_date >= (CURRENT_DATE - INTERVAL '7 days')
  WHERE p.status = 'active'
  GROUP BY p.id, p.title, p.avg_rating
  ORDER BY weighted_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_products_id ON trending_products(id);
