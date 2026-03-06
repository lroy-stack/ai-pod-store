CREATE POLICY "Service role has full access to design compositions" ON design_compositions FOR ALL TO service_role USING (true) WITH CHECK (true);
