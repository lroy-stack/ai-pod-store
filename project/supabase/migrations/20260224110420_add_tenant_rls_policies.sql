-- Tenant-aware RLS policies for multi-tenant data isolation.
-- Service role (used by all server-side API routes) bypasses RLS automatically.
-- These policies protect direct client calls from accessing cross-tenant data.
-- Pattern: allow service_role full access; restrict others by tenant_id via JWT claim.

-- Helper function: extracts tenant_id from JWT app_metadata or custom claim
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    -- Try JWT app_metadata.tenant_id first
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    -- Fallback to custom GUC (set by server before query)
    NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
$$;
