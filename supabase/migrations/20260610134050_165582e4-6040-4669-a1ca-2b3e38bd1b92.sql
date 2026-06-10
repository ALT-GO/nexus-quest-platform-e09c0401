
CREATE TABLE public.satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  ticket_number TEXT,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  rating_response_time SMALLINT NOT NULL CHECK (rating_response_time BETWEEN 1 AND 10),
  rating_communication SMALLINT NOT NULL CHECK (rating_communication BETWEEN 1 AND 10),
  rating_resolution SMALLINT NOT NULL CHECK (rating_resolution BETWEEN 1 AND 10),
  rating_ease_of_use SMALLINT NOT NULL CHECK (rating_ease_of_use BETWEEN 1 AND 10),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.satisfaction_surveys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.satisfaction_surveys TO authenticated;
GRANT ALL ON public.satisfaction_surveys TO service_role;

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a satisfaction survey"
  ON public.satisfaction_surveys FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "TI and Admin can view all surveys"
  ON public.satisfaction_surveys FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "Admin can delete surveys"
  ON public.satisfaction_surveys FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_satisfaction_surveys_created_at ON public.satisfaction_surveys(created_at DESC);
CREATE INDEX idx_satisfaction_surveys_ticket_id ON public.satisfaction_surveys(ticket_id);
