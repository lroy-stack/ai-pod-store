CREATE POLICY "messages_user_insert" ON public.messages FOR INSERT WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
