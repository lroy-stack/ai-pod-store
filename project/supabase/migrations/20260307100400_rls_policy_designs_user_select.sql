CREATE POLICY "designs_user_select" ON public.designs FOR SELECT USING ((auth.uid() = user_id) OR (privacy_level = 'public' AND moderation_status = 'approved'));
