-- Feature #20: Auth sync trigger to create public.users row when auth.users row is created
-- This ensures that when a user signs up via Supabase Auth, they get a corresponding profile in public.users

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into public.users with the same ID as auth.users
  INSERT INTO public.users (
    id,
    email,
    name,
    email_verified,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),  -- Extract name from metadata or use email prefix
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add FK constraint to ensure referential integrity
-- Note: We can't add a traditional FK from public.users.id to auth.users.id
-- because auth schema is managed by Supabase, but we ensure data consistency via the trigger
COMMENT ON COLUMN public.users.id IS 'References auth.users(id). Synchronized via on_auth_user_created trigger.';
