CREATE POLICY "credit_transactions_user_select" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
