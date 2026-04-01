-- Comments table
CREATE TABLE public.marketing_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  avatar_url text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view marketing_task_comments" ON public.marketing_task_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert marketing_task_comments" ON public.marketing_task_comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- History / activity log table
CREATE TABLE public.marketing_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Sistema',
  action text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view marketing_task_history" ON public.marketing_task_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert marketing_task_history" ON public.marketing_task_history
  FOR INSERT TO authenticated WITH CHECK (true);