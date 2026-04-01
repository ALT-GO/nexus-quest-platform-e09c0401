
-- Create a SECURITY DEFINER function to get user emails (auth.users is not directly accessible)
CREATE OR REPLACE FUNCTION public.get_user_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id AS user_id, email::text
  FROM auth.users;
$$;
