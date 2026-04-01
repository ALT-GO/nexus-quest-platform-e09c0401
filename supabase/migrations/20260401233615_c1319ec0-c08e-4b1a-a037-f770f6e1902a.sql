
CREATE TABLE public.marketing_task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'blocking',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.marketing_task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and marketing can manage marketing_task_dependencies"
  ON public.marketing_task_dependencies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_task_dependencies"
  ON public.marketing_task_dependencies FOR SELECT TO authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_task_dependencies;
