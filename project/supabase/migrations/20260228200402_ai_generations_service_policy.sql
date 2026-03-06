CREATE POLICY "Service role has full access to ai generations" ON ai_generations FOR ALL TO service_role USING (true) WITH CHECK (true);
