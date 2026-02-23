-- Disable RLS for admin_settings (admin API uses service role key)
ALTER TABLE public.admin_settings DISABLE ROW LEVEL SECURITY;
