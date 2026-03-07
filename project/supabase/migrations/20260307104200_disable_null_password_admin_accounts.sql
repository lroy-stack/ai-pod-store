UPDATE public.users SET role = 'customer' WHERE email IN ('admin@podplatform.test', 'test-admin-telegram@podai.com') AND password_hash IS NULL;
