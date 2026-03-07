CREATE POLICY "designs_user_delete" ON public.designs FOR DELETE USING (auth.uid() = user_id);
