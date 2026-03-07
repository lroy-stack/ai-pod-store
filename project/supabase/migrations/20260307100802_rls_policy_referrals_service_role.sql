CREATE POLICY "referrals_service_role_all" ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
