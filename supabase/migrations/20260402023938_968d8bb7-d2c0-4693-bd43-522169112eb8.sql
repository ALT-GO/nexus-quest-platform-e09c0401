
-- Add actual_cost to marketing_events
ALTER TABLE public.marketing_events ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT NULL;

-- Create marketing_task_links table for linking tasks to other tasks or events
CREATE TABLE public.marketing_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  linked_task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  linked_event_id uuid REFERENCES public.marketing_events(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_one_link CHECK (
    (linked_task_id IS NOT NULL AND linked_event_id IS NULL) OR
    (linked_task_id IS NULL AND linked_event_id IS NOT NULL)
  )
);

ALTER TABLE public.marketing_task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage task links"
  ON public.marketing_task_links
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_task_links;
