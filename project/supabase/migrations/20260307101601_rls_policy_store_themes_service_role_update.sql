CREATE POLICY "store_themes_service_role_update" ON public.store_themes FOR UPDATE TO service_role USING (true) WITH CHECK (true);
