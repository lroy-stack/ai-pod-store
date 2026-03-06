CREATE POLICY "Users can manage own design compositions" ON design_compositions FOR ALL USING (auth.uid() = user_id);
