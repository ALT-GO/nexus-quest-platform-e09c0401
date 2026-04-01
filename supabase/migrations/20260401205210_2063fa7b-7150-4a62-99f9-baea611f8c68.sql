
-- Make ticket_id nullable to allow marketing-only logs
ALTER TABLE public.timesheet_logs ALTER COLUMN ticket_id DROP NOT NULL;

-- Add marketing_task_id column
ALTER TABLE public.timesheet_logs
  ADD COLUMN marketing_task_id UUID REFERENCES public.marketing_tasks(id) ON DELETE CASCADE;

-- Add check: at least one of ticket_id or marketing_task_id must be set
-- Using a trigger instead of CHECK for flexibility
CREATE OR REPLACE FUNCTION validate_timesheet_log_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL AND NEW.marketing_task_id IS NULL THEN
    RAISE EXCEPTION 'Either ticket_id or marketing_task_id must be set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_timesheet_ref
  BEFORE INSERT OR UPDATE ON public.timesheet_logs
  FOR EACH ROW EXECUTE FUNCTION validate_timesheet_log_reference();
