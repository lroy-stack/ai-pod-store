-- Drop failed policies if they exist
DROP POLICY IF EXISTS "Admin can read settings" ON public.admin_settings;
