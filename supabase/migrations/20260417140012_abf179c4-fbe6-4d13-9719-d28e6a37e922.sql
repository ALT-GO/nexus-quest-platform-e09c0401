
-- Singleton table to store the customizable Sr. Bot avatar URL
CREATE TABLE IF NOT EXISTS public.bot_profile (
  id boolean PRIMARY KEY DEFAULT true,
  avatar_url text NOT NULL DEFAULT 'https://fxpvvcdtpvalamutozzn.supabase.co/storage/v1/object/public/chat-assets/sr-bot-avatar.png',
  display_name text NOT NULL DEFAULT 'Sr. Bot',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bot_profile_singleton CHECK (id = true)
);

ALTER TABLE public.bot_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bot_profile"
  ON public.bot_profile FOR SELECT
  TO authenticated
  USING (true);

-- Anonymous edge functions (with service_role) bypass RLS, but allow anon read for safety
CREATE POLICY "Anon can read bot_profile"
  ON public.bot_profile FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admin can update bot_profile"
  ON public.bot_profile FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert bot_profile"
  ON public.bot_profile FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed the singleton row
INSERT INTO public.bot_profile (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow admins to upload the bot avatar to chat-assets bucket
CREATE POLICY "Admins can upload bot avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-assets'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update bot avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-assets'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
