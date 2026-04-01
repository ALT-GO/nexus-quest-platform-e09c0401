
-- Create marketing_goals table
CREATE TABLE public.marketing_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'number',
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'on_track',
  color TEXT NOT NULL DEFAULT '221 83% 53%',
  folder TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketing_goal_targets table (links tasks or manual values to a goal)
CREATE TABLE public.marketing_goal_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.marketing_goals(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  manual_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_goal_targets ENABLE ROW LEVEL SECURITY;

-- RLS for marketing_goals
CREATE POLICY "Admin and marketing can manage marketing_goals"
  ON public.marketing_goals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_goals"
  ON public.marketing_goals FOR SELECT TO authenticated
  USING (true);

-- RLS for marketing_goal_targets
CREATE POLICY "Admin and marketing can manage marketing_goal_targets"
  ON public.marketing_goal_targets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_goal_targets"
  ON public.marketing_goal_targets FOR SELECT TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_goal_targets;
