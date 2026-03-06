CREATE POLICY "Service role has full access to design sessions" ON design_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
