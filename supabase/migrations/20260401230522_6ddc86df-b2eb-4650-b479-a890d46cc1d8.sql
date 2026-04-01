
-- Create marketing_sprints table
CREATE TABLE public.marketing_sprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  sprint_points_goal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_sprints ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin and marketing can manage marketing_sprints"
  ON public.marketing_sprints FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'marketing'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'marketing'));

CREATE POLICY "Authenticated users can view marketing_sprints"
  ON public.marketing_sprints FOR SELECT
  TO authenticated
  USING (true);

-- Add sprint_id and story_points to marketing_tasks
ALTER TABLE public.marketing_tasks
  ADD COLUMN sprint_id UUID REFERENCES public.marketing_sprints(id) ON DELETE SET NULL,
  ADD COLUMN story_points INTEGER DEFAULT NULL;

-- Enable realtime for sprints
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_sprints;
