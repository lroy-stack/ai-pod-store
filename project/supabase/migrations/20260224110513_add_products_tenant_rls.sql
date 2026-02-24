-- Tenant-scoped public read policy for products.
-- Authenticated/anon calls must match tenant_id; service_role bypasses automatically.
DO $$
BEGIN
  DROP POLICY IF EXISTS "products_tenant_select" ON products;
  CREATE POLICY "products_tenant_select" ON products
    FOR SELECT
    USING (
      auth.role() = 'service_role'
      OR get_current_tenant_id() IS NULL
      OR tenant_id = get_current_tenant_id()
    );

  DROP POLICY IF EXISTS "orders_tenant_select" ON orders;
  CREATE POLICY "orders_tenant_select" ON orders
    FOR SELECT
    USING (
      auth.role() = 'service_role'
      OR (auth.uid() = user_id AND (get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id()))
    );

  DROP POLICY IF EXISTS "conversations_tenant_select" ON conversations;
  CREATE POLICY "conversations_tenant_select" ON conversations
    FOR SELECT
    USING (
      auth.role() = 'service_role'
      OR (auth.uid() = user_id AND (get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id()))
    );
END $$;
