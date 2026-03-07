CREATE POLICY "designs_user_update" ON public.designs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
