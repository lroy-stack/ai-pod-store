CREATE POLICY "cron_runs_service_role_only" ON public.cron_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
