CREATE POLICY "push_subscriptions_user_delete" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
