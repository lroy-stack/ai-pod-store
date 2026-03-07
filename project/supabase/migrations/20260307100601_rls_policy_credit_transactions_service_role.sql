CREATE POLICY "credit_transactions_service_role_all" ON public.credit_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
