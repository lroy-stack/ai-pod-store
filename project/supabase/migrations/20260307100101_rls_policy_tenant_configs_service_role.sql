CREATE POLICY "tenant_configs_service_role_all" ON public.tenant_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
