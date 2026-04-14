CREATE OR REPLACE FUNCTION public.get_profiles_by_role(_role app_role)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = _role
  ORDER BY p.full_name;
$$;