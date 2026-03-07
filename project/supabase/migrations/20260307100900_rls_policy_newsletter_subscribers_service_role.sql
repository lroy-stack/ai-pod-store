CREATE POLICY "newsletter_subscribers_service_role_only" ON public.newsletter_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);
