ALTER TABLE public.marketing_tasks
  ADD COLUMN start_date timestamp with time zone DEFAULT NULL,
  ADD COLUMN due_date timestamp with time zone DEFAULT NULL;