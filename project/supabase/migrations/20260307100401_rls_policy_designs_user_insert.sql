CREATE POLICY "designs_user_insert" ON public.designs FOR INSERT WITH CHECK (auth.uid() = user_id);
