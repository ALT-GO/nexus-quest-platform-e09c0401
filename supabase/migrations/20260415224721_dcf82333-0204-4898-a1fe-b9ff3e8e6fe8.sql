
CREATE TABLE public.collaborator_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'outro',
  document_url TEXT NOT NULL,
  document_name TEXT NOT NULL DEFAULT '',
  signed_at DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborator_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read collaborator_documents"
  ON public.collaborator_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "TI and Admin can insert collaborator_documents"
  ON public.collaborator_documents FOR INSERT
  TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role)
  );

CREATE POLICY "TI and Admin can update collaborator_documents"
  ON public.collaborator_documents FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can delete collaborator_documents"
  ON public.collaborator_documents FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE INDEX idx_collaborator_documents_name ON public.collaborator_documents (collaborator_name);
