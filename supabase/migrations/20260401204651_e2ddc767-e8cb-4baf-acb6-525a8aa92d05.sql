
-- Marketing stages (kanban columns)
CREATE TABLE public.marketing_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  meta_status TEXT NOT NULL DEFAULT 'unstarted' CHECK (meta_status IN ('unstarted', 'in_progress', 'pending_approval', 'completed')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view marketing_stages"
  ON public.marketing_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and marketing can manage marketing_stages"
  ON public.marketing_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing'));

-- Default stages
INSERT INTO public.marketing_stages (name, meta_status, order_index) VALUES
  ('Backlog', 'unstarted', 0),
  ('Design', 'in_progress', 1),
  ('Copywriting', 'in_progress', 2),
  ('Revisão', 'pending_approval', 3),
  ('Concluído', 'completed', 4);

-- Marketing tasks
CREATE TABLE public.marketing_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL DEFAULT '',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name TEXT DEFAULT '',
  stage_id UUID REFERENCES public.marketing_stages(id) ON DELETE SET NULL,
  progress TEXT NOT NULL DEFAULT 'Não iniciado' CHECK (progress IN ('Não iniciado', 'Em andamento', 'Concluído')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view marketing_tasks"
  ON public.marketing_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and marketing can manage marketing_tasks"
  ON public.marketing_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing'));
