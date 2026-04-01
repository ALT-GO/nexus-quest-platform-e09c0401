ALTER TABLE public.marketing_tasks
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN recurrence_rule text,
  ADD COLUMN next_recurrence_date timestamptz;