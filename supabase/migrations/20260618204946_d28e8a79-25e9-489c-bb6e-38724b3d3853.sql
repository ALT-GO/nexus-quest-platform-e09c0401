GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT SELECT ON public.email_templates TO anon;
GRANT ALL ON public.email_templates TO service_role;