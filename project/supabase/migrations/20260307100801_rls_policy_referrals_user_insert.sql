CREATE POLICY "referrals_user_insert" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
