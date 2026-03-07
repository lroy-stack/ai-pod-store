CREATE POLICY "translations_service_role_all" ON public.translations FOR ALL TO service_role USING (true) WITH CHECK (true);
