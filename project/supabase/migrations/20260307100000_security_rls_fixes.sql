-- Migration: Security RLS Fixes
-- Enable RLS on unprotected tables, add policies to tables with 0 policies,
-- and add storage bucket policies.

-- ============================================================
-- 1. Enable RLS on tables that have it disabled
-- ============================================================
ALTER TABLE IF EXISTS design_clipart ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_templates_library ENABLE ROW LEVEL SECURITY;

-- Policies for design_clipart (read-only for authenticated users)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'design_clipart' AND policyname = 'design_clipart_select_authenticated') THEN
    CREATE POLICY design_clipart_select_authenticated ON design_clipart FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Policies for design_templates_library (read-only for authenticated users)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'design_templates_library' AND policyname = 'design_templates_library_select_authenticated') THEN
    CREATE POLICY design_templates_library_select_authenticated ON design_templates_library FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 2. Add policies to 14 tables with RLS enabled but 0 policies
-- ============================================================

-- admin_roles: Only service_role (admin panel uses service key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_roles' AND policyname = 'admin_roles_service_role_all') THEN
    CREATE POLICY admin_roles_service_role_all ON admin_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- association_rules: Read for authenticated, write for service_role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'association_rules' AND policyname = 'association_rules_select_authenticated') THEN
    CREATE POLICY association_rules_select_authenticated ON association_rules FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'association_rules' AND policyname = 'association_rules_write_service') THEN
    CREATE POLICY association_rules_write_service ON association_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- customer_segments: Service role only (internal analytics)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_segments' AND policyname = 'customer_segments_service_role_all') THEN
    CREATE POLICY customer_segments_service_role_all ON customer_segments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- demand_forecasts: Service role only (internal analytics)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'demand_forecasts' AND policyname = 'demand_forecasts_service_role_all') THEN
    CREATE POLICY demand_forecasts_service_role_all ON demand_forecasts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- documents: Public read (legal docs, etc.), service_role write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_select_public') THEN
    CREATE POLICY documents_select_public ON documents FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_write_service') THEN
    CREATE POLICY documents_write_service ON documents FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- drip_queue: Service role only (newsletter agent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drip_queue' AND policyname = 'drip_queue_service_role_all') THEN
    CREATE POLICY drip_queue_service_role_all ON drip_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- heartbeat_events: Service role only (PodClaw internal)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'heartbeat_events' AND policyname = 'heartbeat_events_service_role_all') THEN
    CREATE POLICY heartbeat_events_service_role_all ON heartbeat_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- marketing_content: Service role only (agent-generated)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_content' AND policyname = 'marketing_content_service_role_all') THEN
    CREATE POLICY marketing_content_service_role_all ON marketing_content FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- newsletter_campaigns: Service role only (newsletter agent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_campaigns' AND policyname = 'newsletter_campaigns_service_role_all') THEN
    CREATE POLICY newsletter_campaigns_service_role_all ON newsletter_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- price_history: Service role only (pricing agent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_history' AND policyname = 'price_history_service_role_all') THEN
    CREATE POLICY price_history_service_role_all ON price_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- processed_events: Service role only (webhook dedup)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'processed_events' AND policyname = 'processed_events_service_role_all') THEN
    CREATE POLICY processed_events_service_role_all ON processed_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- soul_change_log: Service role only (PodClaw internal)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'soul_change_log' AND policyname = 'soul_change_log_service_role_all') THEN
    CREATE POLICY soul_change_log_service_role_all ON soul_change_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- system_events: Service role only (internal events)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_events' AND policyname = 'system_events_service_role_all') THEN
    CREATE POLICY system_events_service_role_all ON system_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- user_roles: Service role only (admin RBAC)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_service_role_all') THEN
    CREATE POLICY user_roles_service_role_all ON user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 3. Storage bucket RLS policies (on storage.objects)
-- ============================================================

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- designs bucket: authenticated can SELECT, only service_role can INSERT/DELETE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'designs_select_authenticated') THEN
    CREATE POLICY designs_select_authenticated ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'designs');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'designs_insert_service') THEN
    CREATE POLICY designs_insert_service ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = 'designs');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'designs_delete_service') THEN
    CREATE POLICY designs_delete_service ON storage.objects FOR DELETE
      TO service_role
      USING (bucket_id = 'designs');
  END IF;
END $$;

-- product-images bucket: public read (anon + authenticated), only service_role writes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'product_images_select_public') THEN
    CREATE POLICY product_images_select_public ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'product-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'product_images_insert_service') THEN
    CREATE POLICY product_images_insert_service ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = 'product-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'product_images_delete_service') THEN
    CREATE POLICY product_images_delete_service ON storage.objects FOR DELETE
      TO service_role
      USING (bucket_id = 'product-images');
  END IF;
END $$;
