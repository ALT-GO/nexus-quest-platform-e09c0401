
CREATE TABLE public.sla_category_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL UNIQUE,
  sla_hours integer NOT NULL DEFAULT 24,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_category_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sla_category_config"
  ON public.sla_category_config FOR SELECT
  TO public USING (true);

CREATE POLICY "Admins can insert sla_category_config"
  ON public.sla_category_config FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sla_category_config"
  ON public.sla_category_config FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sla_category_config"
  ON public.sla_category_config FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default SLA values
INSERT INTO public.sla_category_config (category, sla_hours) VALUES
  ('Acesso e permissões', 4),
  ('Problemas com Computador/Notebook', 8),
  ('Problemas com Celular/Tablet', 8),
  ('Rede e Internet', 4),
  ('E-mail e Comunicação', 4),
  ('Serviços de Impressão', 8),
  ('Sistemas Corporativos', 8),
  ('Solicitação de novo Computador/Notebook', 72),
  ('Solicitação de novo Celular', 72),
  ('Solicitação de Tablet', 72),
  ('Gerais/Outros', 24);
