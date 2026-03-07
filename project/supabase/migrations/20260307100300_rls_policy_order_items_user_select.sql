CREATE POLICY "order_items_user_select" ON public.order_items FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
