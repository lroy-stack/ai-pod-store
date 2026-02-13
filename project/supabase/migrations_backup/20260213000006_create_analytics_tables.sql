-- Migration: Create Analytics Tables
-- Description: Create customer_segments, demand_forecasts, price_history, association_rules, ab_experiments, ab_events
-- Date: 2026-02-13

-- =============================================
-- CUSTOMER SEGMENTS TABLE (RFM Analysis)
-- =============================================
CREATE TABLE IF NOT EXISTS customer_segments (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recency INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  monetary NUMERIC NOT NULL,
  rfm_score TEXT NOT NULL,
  segment TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DEMAND FORECASTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_quantity NUMERIC NOT NULL,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, forecast_date)
);

-- =============================================
-- PRICE HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ASSOCIATION RULES TABLE (Market Basket Analysis)
-- =============================================
CREATE TABLE IF NOT EXISTS association_rules (
  id BIGSERIAL PRIMARY KEY,
  antecedents TEXT[] NOT NULL,
  consequents TEXT[] NOT NULL,
  support NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  lift NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- A/B EXPERIMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- A/B EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS ab_events (
  id BIGSERIAL PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'revenue')),
  value NUMERIC,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR ANALYTICS TABLES
-- =============================================

-- Customer segments indexes
CREATE INDEX IF NOT EXISTS idx_customer_segments_segment ON customer_segments(segment);
CREATE INDEX IF NOT EXISTS idx_customer_segments_rfm_score ON customer_segments(rfm_score);
CREATE INDEX IF NOT EXISTS idx_customer_segments_updated_at ON customer_segments(updated_at DESC);

-- Demand forecasts indexes
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product_id ON demand_forecasts(product_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product_date ON demand_forecasts(product_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON demand_forecasts(forecast_date);

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_period_start ON price_history(period_start);
CREATE INDEX IF NOT EXISTS idx_price_history_product_period ON price_history(product_id, period_start);

-- Association rules indexes
CREATE INDEX IF NOT EXISTS idx_association_rules_created_at ON association_rules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_association_rules_lift ON association_rules(lift DESC);

-- A/B experiments indexes
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_created_at ON ab_experiments(created_at DESC);

-- A/B events indexes
CREATE INDEX IF NOT EXISTS idx_ab_events_experiment_id ON ab_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_events_experiment_variant ON ab_events(experiment_id, variant);
CREATE INDEX IF NOT EXISTS idx_ab_events_created_at ON ab_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_events_event_type ON ab_events(event_type);
