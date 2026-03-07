CREATE POLICY "orders_user_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
