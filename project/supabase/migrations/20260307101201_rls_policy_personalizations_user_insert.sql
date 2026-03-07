CREATE POLICY "personalizations_user_insert" ON public.personalizations FOR INSERT WITH CHECK (auth.uid() = user_id);
