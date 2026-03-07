CREATE POLICY "return_requests_user_insert" ON public.return_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
