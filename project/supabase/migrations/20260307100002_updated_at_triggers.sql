-- Migration: Auto-update updated_at triggers
-- Create trigger function and apply to 17 tables missing the trigger

-- ============================================================
-- 1. Create or replace the trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Add triggers to tables missing them
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  trigger_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'admin_roles',
    'admin_settings',
    'agent_daily_costs',
    'brand_config',
    'categories',
    'coupons',
    'customer_segments',
    'design_compositions',
    'design_sessions',
    'messaging_channels',
    'personalizations',
    'product_beliefs',
    'seo_meta_tags',
    'shipping_zones',
    'tenant_configs',
    'translations',
    'user_usage'
  ])
  LOOP
    trigger_name := 'trg_' || tbl || '_updated_at';
    -- Only create if trigger doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = trigger_name
      AND tgrelid = tbl::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        trigger_name, tbl
      );
    END IF;
  END LOOP;
END $$;
