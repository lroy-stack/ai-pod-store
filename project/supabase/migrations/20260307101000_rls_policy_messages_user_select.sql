CREATE POLICY "messages_user_select" ON public.messages FOR SELECT USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
