
-- Events table
CREATE TABLE public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text DEFAULT '',
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  budget numeric DEFAULT 0,
  notes text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'planning',
  checklist jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and marketing can manage marketing_events"
  ON public.marketing_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_events"
  ON public.marketing_events FOR SELECT TO authenticated
  USING (true);

-- Event participants junction table
CREATE TABLE public.marketing_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.marketing_events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, profile_id)
);

ALTER TABLE public.marketing_event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and marketing can manage marketing_event_participants"
  ON public.marketing_event_participants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_event_participants"
  ON public.marketing_event_participants FOR SELECT TO authenticated
  USING (true);

-- Add event_id to marketing_tasks
ALTER TABLE public.marketing_tasks ADD COLUMN event_id uuid REFERENCES public.marketing_events(id) ON DELETE SET NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_events;
