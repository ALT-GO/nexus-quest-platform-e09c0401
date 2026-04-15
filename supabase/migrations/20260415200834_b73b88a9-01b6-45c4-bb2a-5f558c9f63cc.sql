-- Add unit_cost and total_quantity to marketing_materials
ALTER TABLE public.marketing_materials
ADD COLUMN unit_cost numeric DEFAULT NULL,
ADD COLUMN total_quantity integer DEFAULT NULL;

-- Create allocation junction table
CREATE TABLE public.marketing_material_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id uuid NOT NULL REFERENCES public.marketing_materials(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.marketing_events(id) ON DELETE CASCADE,
  allocation_type text NOT NULL DEFAULT 'value',
  quantity_used integer DEFAULT 0,
  allocated_value numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(material_id, event_id)
);

ALTER TABLE public.marketing_material_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and marketing can manage marketing_material_allocations"
ON public.marketing_material_allocations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_material_allocations"
ON public.marketing_material_allocations
FOR SELECT
TO authenticated
USING (true);