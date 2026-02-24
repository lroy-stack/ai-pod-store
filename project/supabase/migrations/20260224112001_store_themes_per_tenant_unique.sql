-- Replace global is_active/is_default unique indexes with per-tenant versions.
-- Per-tenant: each tenant can have their own active and default theme.
-- Global (tenant_id IS NULL): platform-level themes retain one active, one default.
DO $$
BEGIN
  DROP INDEX IF EXISTS store_themes_unique_active;
  DROP INDEX IF EXISTS store_themes_unique_default;

  -- Per-tenant active theme: UNIQUE(tenant_id) WHERE is_active = true AND tenant_id IS NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'store_themes_per_tenant_active'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX store_themes_per_tenant_active
      ON store_themes (tenant_id)
      WHERE is_active = true AND tenant_id IS NOT NULL';
  END IF;

  -- Global active theme: only one active when tenant_id IS NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'store_themes_global_active'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX store_themes_global_active
      ON store_themes ((is_active))
      WHERE is_active = true AND tenant_id IS NULL';
  END IF;

  -- Per-tenant default theme
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'store_themes_per_tenant_default'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX store_themes_per_tenant_default
      ON store_themes (tenant_id)
      WHERE is_default = true AND tenant_id IS NOT NULL';
  END IF;

  -- Global default theme
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'store_themes_global_default'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX store_themes_global_default
      ON store_themes ((is_default))
      WHERE is_default = true AND tenant_id IS NULL';
  END IF;
END $$;
