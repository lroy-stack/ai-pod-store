CREATE POLICY "designs_service_role_all" ON public.designs FOR ALL TO service_role USING (true) WITH CHECK (true);
