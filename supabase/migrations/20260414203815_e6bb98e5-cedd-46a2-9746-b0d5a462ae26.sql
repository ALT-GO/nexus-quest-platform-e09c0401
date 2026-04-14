
CREATE TABLE public.inventory_status_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_group text NOT NULL DEFAULT 'hardware',
  name text NOT NULL,
  color text NOT NULL DEFAULT '221 83% 53%',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read inventory_status_config"
  ON public.inventory_status_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "TI and Admin can insert inventory_status_config"
  ON public.inventory_status_config FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can update inventory_status_config"
  ON public.inventory_status_config FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can delete inventory_status_config"
  ON public.inventory_status_config FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

-- Seed default hardware statuses
INSERT INTO public.inventory_status_config (category_group, name, color, order_index) VALUES
  ('hardware', 'Disponível', '152 69% 31%', 1),
  ('hardware', 'Em uso', '217 91% 60%', 2),
  ('hardware', 'Manutenção', '38 92% 50%', 3),
  ('hardware', 'Reservado', '220 9% 46%', 4),
  ('hardware', 'Baixado', '220 9% 46%', 5);

-- Seed default software statuses
INSERT INTO public.inventory_status_config (category_group, name, color, order_index) VALUES
  ('software', 'Ativo', '152 69% 31%', 1),
  ('software', 'Desligado', '0 84% 60%', 2),
  ('software', 'Inativo', '220 9% 46%', 3);
