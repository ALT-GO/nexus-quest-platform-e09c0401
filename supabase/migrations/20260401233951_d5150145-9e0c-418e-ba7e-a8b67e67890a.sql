
-- Create task types table
CREATE TABLE public.marketing_task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'clipboard-list',
  color text NOT NULL DEFAULT '262 83% 58%',
  default_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and marketing can manage marketing_task_types"
  ON public.marketing_task_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Authenticated users can view marketing_task_types"
  ON public.marketing_task_types FOR SELECT TO authenticated
  USING (true);

-- Add task_type_id to marketing_tasks
ALTER TABLE public.marketing_tasks
  ADD COLUMN task_type_id uuid REFERENCES public.marketing_task_types(id) ON DELETE SET NULL;

-- Seed default types
INSERT INTO public.marketing_task_types (name, icon, color, order_index) VALUES
  ('Tarefa', 'clipboard-list', '262 83% 58%', 0),
  ('Bug', 'bug', '0 84% 60%', 1),
  ('Feature', 'lightbulb', '142 71% 45%', 2),
  ('Campanha', 'megaphone', '221 83% 53%', 3),
  ('Conteúdo', 'file-text', '25 95% 53%', 4);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_task_types;
