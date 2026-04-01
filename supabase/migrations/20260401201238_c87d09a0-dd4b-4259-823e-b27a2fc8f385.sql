
CREATE OR REPLACE FUNCTION public.get_ti_admin_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  FROM public.user_roles
  WHERE role IN ('ti', 'admin')
$$;
