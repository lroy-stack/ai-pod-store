CREATE POLICY "Users can manage own design assets" ON user_design_assets FOR ALL USING (auth.uid() = user_id);
