
-- Allow users with global admin permission (acesso_admin_global) to manage email templates,
-- not only those with the 'admin' role.

CREATE OR REPLACE FUNCTION public.has_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.has_role(_user_id, 'admin'::app_role),
    false
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND COALESCE((permissions->>'acesso_admin_global')::boolean, false) = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_global_admin(uuid) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Admins update email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins insert email_templates" ON public.email_templates;

CREATE POLICY "Admins update email_templates"
ON public.email_templates
FOR UPDATE
TO authenticated
USING (public.has_global_admin(auth.uid()))
WITH CHECK (public.has_global_admin(auth.uid()));

CREATE POLICY "Admins insert email_templates"
ON public.email_templates
FOR INSERT
TO authenticated
WITH CHECK (public.has_global_admin(auth.uid()));
