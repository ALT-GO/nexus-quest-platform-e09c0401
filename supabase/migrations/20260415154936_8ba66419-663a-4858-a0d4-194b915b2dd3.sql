
-- Create marketing_materials table
CREATE TABLE public.marketing_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  purchase_date TIMESTAMP WITH TIME ZONE,
  budget NUMERIC DEFAULT 0,
  actual_cost NUMERIC,
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  checklist JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  linked_event_id UUID REFERENCES public.marketing_events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_materials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin and marketing can manage marketing_materials"
ON public.marketing_materials FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_materials"
ON public.marketing_materials FOR SELECT TO authenticated
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_materials;
