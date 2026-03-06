CREATE POLICY "Service role has full access to design assets" ON user_design_assets FOR ALL TO service_role USING (true) WITH CHECK (true);
