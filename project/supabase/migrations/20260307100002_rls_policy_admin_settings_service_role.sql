CREATE POLICY "admin_settings_service_role_only" ON public.admin_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
