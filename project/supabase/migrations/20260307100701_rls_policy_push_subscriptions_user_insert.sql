CREATE POLICY "push_subscriptions_user_insert" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
