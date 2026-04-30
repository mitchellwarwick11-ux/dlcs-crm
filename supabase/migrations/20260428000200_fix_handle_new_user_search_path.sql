-- Fix latent bug in handle_new_user(): the original function did not
-- qualify the staff_profiles table name and did not set a search_path,
-- so it failed if the auth role's search_path didn't include public.
-- This bites after `DROP SCHEMA public CASCADE` + recreate, which is
-- the standard reset workflow for staging environments.
--
-- The fix: qualify the table reference and pin search_path on the
-- function so it works regardless of caller's search_path.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.staff_profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'drafting'
  );
  RETURN NEW;
END;
$$;
