CREATE POLICY "Users can manage own ai generations" ON ai_generations FOR ALL USING (auth.uid() = user_id);
