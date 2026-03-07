CREATE POLICY "order_items_service_role_all" ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
