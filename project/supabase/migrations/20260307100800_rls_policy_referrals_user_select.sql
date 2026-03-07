CREATE POLICY "referrals_user_select" ON public.referrals FOR SELECT USING ((auth.uid() = referrer_id) OR (auth.uid() = referred_id));
