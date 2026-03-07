ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY buckets_select_authenticated ON storage.buckets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY buckets_admin_all ON storage.buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
