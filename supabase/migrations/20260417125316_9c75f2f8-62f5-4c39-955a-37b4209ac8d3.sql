-- Create public bucket for chat assets (bot avatar, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-assets', 'chat-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
DROP POLICY IF EXISTS "Public can view chat-assets" ON storage.objects;
CREATE POLICY "Public can view chat-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-assets');

-- Admin can upload to chat-assets
DROP POLICY IF EXISTS "Admins can upload chat-assets" ON storage.objects;
CREATE POLICY "Admins can upload chat-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-assets' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update chat-assets" ON storage.objects;
CREATE POLICY "Admins can update chat-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-assets' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete chat-assets" ON storage.objects;
CREATE POLICY "Admins can delete chat-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-assets' AND has_role(auth.uid(), 'admin'::app_role));