CREATE POLICY "push_subscriptions_user_select" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
