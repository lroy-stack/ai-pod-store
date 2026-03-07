CREATE POLICY "returns_service_role_only" ON public.returns FOR ALL TO service_role USING (true) WITH CHECK (true);
