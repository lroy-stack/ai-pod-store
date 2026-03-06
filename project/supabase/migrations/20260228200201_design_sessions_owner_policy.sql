CREATE POLICY "Users can manage own design sessions" ON design_sessions FOR ALL USING (auth.uid() = user_id);
