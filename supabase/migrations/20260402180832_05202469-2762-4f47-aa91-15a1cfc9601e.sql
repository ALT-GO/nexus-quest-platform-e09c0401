ALTER TABLE public.marketing_tasks
  ADD COLUMN completed_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN completed_by text DEFAULT NULL;