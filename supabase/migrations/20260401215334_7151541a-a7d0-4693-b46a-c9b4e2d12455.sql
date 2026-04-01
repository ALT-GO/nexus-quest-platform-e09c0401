-- Tags table
CREATE TABLE public.marketing_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '221 83% 53%',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view marketing_tags" ON public.marketing_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and marketing can manage marketing_tags" ON public.marketing_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

-- Junction table
CREATE TABLE public.marketing_task_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.marketing_tags(id) ON DELETE CASCADE,
  UNIQUE(task_id, tag_id)
);

ALTER TABLE public.marketing_task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view marketing_task_tags" ON public.marketing_task_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and marketing can manage marketing_task_tags" ON public.marketing_task_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));