CREATE POLICY "conversations_user_update" ON public.conversations FOR UPDATE USING (user_id = auth.uid());
