
-- Allow TI users to read all profiles
CREATE POLICY "TI can read all profiles"
ON public.profiles
FOR SELECT
TO public
USING (public.has_role(auth.uid(), 'ti'::app_role));

-- Allow TI users to read all user_roles
CREATE POLICY "TI can read all roles"
ON public.user_roles
FOR SELECT
TO public
USING (public.has_role(auth.uid(), 'ti'::app_role));
