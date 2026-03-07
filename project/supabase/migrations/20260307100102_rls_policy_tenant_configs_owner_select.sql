CREATE POLICY "tenant_configs_owner_select" ON public.tenant_configs FOR SELECT TO authenticated USING (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()));
