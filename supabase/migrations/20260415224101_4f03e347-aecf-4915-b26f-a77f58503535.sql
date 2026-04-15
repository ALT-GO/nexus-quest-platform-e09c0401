
-- Create attachments table for OneDrive links
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ticket', 'marketing_task', 'public_request')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  added_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_attachments_entity ON public.attachments (entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all attachments
CREATE POLICY "Authenticated users can view attachments"
  ON public.attachments FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can insert attachments
CREATE POLICY "Authenticated users can insert attachments"
  ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (true);

-- Authenticated users can delete attachments they added
CREATE POLICY "Authenticated users can delete attachments"
  ON public.attachments FOR DELETE TO authenticated
  USING (true);

-- Anonymous users can insert attachments (for public forms)
CREATE POLICY "Anonymous users can insert attachments"
  ON public.attachments FOR INSERT TO anon
  WITH CHECK (entity_type = 'public_request');
