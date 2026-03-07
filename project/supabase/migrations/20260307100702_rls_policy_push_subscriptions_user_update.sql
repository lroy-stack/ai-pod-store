CREATE POLICY "push_subscriptions_user_update" ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
