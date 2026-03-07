CREATE POLICY "error_logs_service_role_update" ON public.error_logs FOR UPDATE TO service_role USING (true) WITH CHECK (true);
