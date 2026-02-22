-- Analytics RPC functions for the PodClaw ETL layer
-- These are called by the product-metrics cron job and by agents directly.

-- Compute daily product metrics from order_items for a given date
CREATE OR REPLACE FUNCTION compute_daily_product_metrics(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO product_daily_metrics (product_id, metric_date, orders, units_sold, revenue_cents, cogs_cents)
  SELECT
    oi.product_id,
    target_date,
    COUNT(DISTINCT oi.order_id),
    SUM(oi.quantity),
    SUM(oi.unit_price_cents * oi.quantity),
    SUM(COALESCE(oi.cost_cents, 0) * oi.quantity)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.paid_at::date = target_date
    AND o.status NOT IN ('cancelled', 'refunded')
    AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  ON CONFLICT (product_id, metric_date)
  DO UPDATE SET
    orders = EXCLUDED.orders,
    units_sold = EXCLUDED.units_sold,
    revenue_cents = EXCLUDED.revenue_cents,
    cogs_cents = EXCLUDED.cogs_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compute portfolio-level metrics for a given date
CREATE OR REPLACE FUNCTION compute_portfolio_metrics(target_date DATE)
RETURNS void AS $$
DECLARE
  v_revenue INTEGER;
  v_orders INTEGER;
  v_aov INTEGER;
  v_margin DOUBLE PRECISION;
  v_refund_rate DOUBLE PRECISION;
  v_active INTEGER;
  v_zombie INTEGER;
  v_new INTEGER;
  v_delisted INTEGER;
BEGIN
  -- Revenue and orders
  SELECT COALESCE(SUM(total_cents), 0), COUNT(*)
  INTO v_revenue, v_orders
  FROM orders
  WHERE paid_at::date = target_date AND status NOT IN ('cancelled', 'refunded');

  v_aov := CASE WHEN v_orders > 0 THEN v_revenue / v_orders ELSE 0 END;

  -- Gross margin
  SELECT CASE
    WHEN SUM(revenue_cents) > 0 THEN (SUM(revenue_cents) - SUM(cogs_cents))::double precision / SUM(revenue_cents) * 100
    ELSE 0
  END INTO v_margin
  FROM product_daily_metrics WHERE metric_date = target_date;

  -- Refund rate (last 30 days)
  SELECT CASE
    WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE status = 'refunded')::double precision / COUNT(*) * 100
    ELSE 0
  END INTO v_refund_rate
  FROM orders WHERE paid_at >= target_date - INTERVAL '30 days';

  -- Active products
  SELECT COUNT(*) INTO v_active FROM products WHERE status = 'active';

  -- Zombie products (active, 0 sales in 30 days)
  SELECT COUNT(*) INTO v_zombie
  FROM products p
  WHERE p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = p.id AND o.paid_at >= target_date - INTERVAL '30 days'
    );

  -- New products listed today
  SELECT COUNT(*) INTO v_new FROM products WHERE created_at::date = target_date;

  -- Products delisted today
  SELECT COUNT(*) INTO v_delisted FROM products
  WHERE status IN ('archived', 'deleted') AND updated_at::date = target_date;

  INSERT INTO daily_portfolio_metrics (date, total_revenue_cents, total_orders, aov_cents, gross_margin_pct, refund_rate_pct, active_products, zombie_products, new_products_listed, products_delisted)
  VALUES (target_date, v_revenue, v_orders, v_aov, v_margin, v_refund_rate, v_active, v_zombie, v_new, v_delisted)
  ON CONFLICT (date) DO UPDATE SET
    total_revenue_cents = EXCLUDED.total_revenue_cents,
    total_orders = EXCLUDED.total_orders,
    aov_cents = EXCLUDED.aov_cents,
    gross_margin_pct = EXCLUDED.gross_margin_pct,
    refund_rate_pct = EXCLUDED.refund_rate_pct,
    active_products = EXCLUDED.active_products,
    zombie_products = EXCLUDED.zombie_products,
    new_products_listed = EXCLUDED.new_products_listed,
    products_delisted = EXCLUDED.products_delisted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update product belief with new observations (Bayesian update)
CREATE OR REPLACE FUNCTION update_product_belief(
  p_id UUID,
  new_views INTEGER,
  new_sales INTEGER,
  new_revenue INTEGER DEFAULT 0,
  new_cogs INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO product_beliefs (product_id, alpha, beta, views_total, sales_total, revenue_total_cents, cogs_total_cents)
  VALUES (p_id, 1.0 + new_sales, 1.0 + (new_views - new_sales), new_views, new_sales, new_revenue, new_cogs)
  ON CONFLICT (product_id) DO UPDATE SET
    alpha = product_beliefs.alpha + new_sales,
    beta = product_beliefs.beta + (new_views - new_sales),
    views_total = product_beliefs.views_total + new_views,
    sales_total = product_beliefs.sales_total + new_sales,
    revenue_total_cents = product_beliefs.revenue_total_cents + new_revenue,
    cogs_total_cents = product_beliefs.cogs_total_cents + new_cogs,
    last_sale_at = CASE WHEN new_sales > 0 THEN NOW() ELSE product_beliefs.last_sale_at END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
