CREATE POLICY "conversations_user_insert" ON public.conversations FOR INSERT WITH CHECK (user_id = auth.uid());
