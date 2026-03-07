CREATE POLICY "product_reviews_user_insert" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
