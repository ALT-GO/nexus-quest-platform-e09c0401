
CREATE TABLE IF NOT EXISTS public.ticket_assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_assignment_queue TO authenticated;
GRANT ALL ON public.ticket_assignment_queue TO service_role;

ALTER TABLE public.ticket_assignment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view queue"
  ON public.ticket_assignment_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage queue insert"
  ON public.ticket_assignment_queue FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage queue update"
  ON public.ticket_assignment_queue FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage queue delete"
  ON public.ticket_assignment_queue FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ticket_assignment_queue_updated_at
  BEFORE UPDATE ON public.ticket_assignment_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_templates_updated_at();

-- Replace round-robin function to honor the queue when populated
CREATE OR REPLACE FUNCTION public.pick_round_robin_assignee(_roles app_role[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_full_name text;
  v_has_queue boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.ticket_assignment_queue WHERE is_active = true) INTO v_has_queue;

  IF v_has_queue THEN
    SELECT q.user_id, q.full_name
      INTO v_user_id, v_full_name
    FROM public.ticket_assignment_queue q
    WHERE q.is_active = true
    ORDER BY q.last_assigned_at ASC NULLS FIRST, q.position ASC, q.created_at ASC
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.ticket_assignment_queue
         SET last_assigned_at = now()
       WHERE ticket_assignment_queue.user_id = v_user_id;
      RETURN QUERY SELECT v_user_id, v_full_name;
      RETURN;
    END IF;
  END IF;

  -- Fallback: legacy load-based picker among eligible roles
  RETURN QUERY
  WITH eligible AS (
    SELECT DISTINCT p.id, p.full_name
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = ANY(_roles)
  ),
  ticket_load AS (
    SELECT t.assignee AS name, COUNT(*) AS c
    FROM public.tickets t
    INNER JOIN public.status_config sc ON sc.id = t.status_id
    WHERE t.assignee IS NOT NULL AND COALESCE(sc.is_final, false) = false
    GROUP BY t.assignee
  ),
  mkt_load AS (
    SELECT mt.assignee_id, COUNT(*) AS c
    FROM public.marketing_tasks mt
    WHERE mt.assignee_id IS NOT NULL AND mt.completed_at IS NULL
    GROUP BY mt.assignee_id
  ),
  loads AS (
    SELECT e.id, e.full_name,
           COALESCE(tl.c, 0) + COALESCE(ml.c, 0) AS total
    FROM eligible e
    LEFT JOIN ticket_load tl ON tl.name = e.full_name
    LEFT JOIN mkt_load ml ON ml.assignee_id = e.id
  )
  SELECT id, full_name FROM loads
  ORDER BY total ASC, random()
  LIMIT 1;
END;
$function$;
