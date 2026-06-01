
-- 1. Round-robin assignee picker
CREATE OR REPLACE FUNCTION public.pick_round_robin_assignee(_roles app_role[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.pick_round_robin_assignee(app_role[]) TO anon, authenticated, service_role;

-- 2. Update create_public_ticket to auto-assign via round-robin
CREATE OR REPLACE FUNCTION public.create_public_ticket(
  p_title text, p_category text, p_description text, p_requester text, p_email text,
  p_department text DEFAULT NULL::text, p_priority text DEFAULT 'medium'::text,
  p_parent_ticket_id uuid DEFAULT NULL::uuid,
  p_sla_deadline_override timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_assignee text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, ticket_number text, assignee text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_category_map jsonb := jsonb_build_object(
    'Solicitação de novo Computador/Notebook', 'Solicitações de Notebook',
    'Solicitação de novo Celular', 'Solicitação de Celular',
    'Solicitação de nova Linha', 'Solicitação de Linhas',
    'Solicitação de Tablet', 'Solicitação de Tablet',
    'Contratação', 'Contratações',
    'Desligamento', 'Desligamentos'
  );
  v_target_column text;
  v_status_id text;
  v_max_ordem int;
  v_sla_hours int;
  v_sla_deadline timestamptz;
  v_new_id uuid;
  v_new_number text;
  v_assignee text;
  v_assignee_id uuid;
BEGIN
  v_target_column := COALESCE(v_category_map ->> p_category, 'Novos Chamados');

  SELECT sc.id INTO v_status_id
  FROM public.status_config sc
  WHERE sc.nome = v_target_column
  ORDER BY sc.ordem NULLS LAST
  LIMIT 1;

  IF v_status_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem FROM public.status_config;
    v_status_id := 'auto_' || regexp_replace(lower(v_target_column), '[^a-z0-9]', '_', 'g') || '_' || extract(epoch from now())::bigint;
    INSERT INTO public.status_config (id, nome, cor, ordem, ativo, is_final, status_type)
    VALUES (v_status_id, v_target_column, '221 83% 53%', v_max_ordem + 1, true, false, 'todo');
  END IF;

  SELECT scc.sla_hours INTO v_sla_hours
  FROM public.sla_category_config scc
  WHERE scc.category = p_category
  LIMIT 1;

  v_sla_hours := COALESCE(v_sla_hours, 24);
  v_sla_deadline := COALESCE(p_sla_deadline_override, now() + make_interval(hours => v_sla_hours));

  -- Resolve assignee: use provided one, otherwise round-robin among TI/Admin
  v_assignee := NULLIF(p_assignee, '');
  IF v_assignee IS NULL THEN
    SELECT rr.full_name INTO v_assignee
    FROM public.pick_round_robin_assignee(ARRAY['ti','admin']::app_role[]) rr;
  END IF;

  INSERT INTO public.tickets (
    title, category, description, requester, email, department, priority,
    status_id, sla_hours, sla_deadline, ticket_number, parent_ticket_id, assignee
  ) VALUES (
    COALESCE(NULLIF(p_title, ''), p_category),
    p_category, p_description, p_requester, p_email, NULLIF(p_department, ''),
    COALESCE(NULLIF(p_priority, ''), 'medium'),
    v_status_id, v_sla_hours, v_sla_deadline, '', p_parent_ticket_id, v_assignee
  )
  RETURNING tickets.id, tickets.ticket_number INTO v_new_id, v_new_number;

  -- Notify the auto-assigned user
  IF v_assignee IS NOT NULL THEN
    SELECT p.id INTO v_assignee_id FROM public.profiles p WHERE p.full_name = v_assignee LIMIT 1;
    IF v_assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link, scope)
      VALUES (
        v_assignee_id,
        'Chamado atribuído a você',
        'Você foi atribuído automaticamente ao chamado ' || v_new_number || ' — ' || COALESCE(NULLIF(p_title,''), p_category),
        'task_assigned',
        '/ti/service-desk?ticket=' || v_new_id::text,
        'ti'
      );
    END IF;
  END IF;

  RETURN QUERY SELECT v_new_id, v_new_number, v_assignee;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_public_ticket(text, text, text, text, text, text, text, uuid, timestamptz, text) TO anon, authenticated, service_role;

-- 3. Public marketing task creator with round-robin
CREATE OR REPLACE FUNCTION public.create_public_marketing_task(
  p_title text,
  p_description text,
  p_requester_name text,
  p_requester_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'medium',
  p_assignee_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, assignee_id uuid, assignee_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
  v_next_order int;
  v_new_id uuid;
  v_assignee_id uuid := p_assignee_id;
  v_assignee_name text := '';
BEGIN
  SELECT id INTO v_stage_id FROM public.marketing_stages ORDER BY order_index LIMIT 1;
  SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_next_order FROM public.marketing_tasks;

  -- Round-robin among marketing/admin if no explicit assignee
  IF v_assignee_id IS NULL THEN
    SELECT rr.user_id, rr.full_name
      INTO v_assignee_id, v_assignee_name
    FROM public.pick_round_robin_assignee(ARRAY['marketing','admin']::app_role[]) rr;
  ELSE
    SELECT full_name INTO v_assignee_name FROM public.profiles WHERE profiles.id = v_assignee_id;
  END IF;

  INSERT INTO public.marketing_tasks (
    title, description, requester_id, requester_name,
    assignee_id, assignee_name, stage_id, priority, progress, order_index
  ) VALUES (
    p_title, p_description, p_requester_id, p_requester_name,
    v_assignee_id, COALESCE(v_assignee_name, ''), v_stage_id,
    COALESCE(NULLIF(p_priority, ''), 'medium'), 'Não iniciado', v_next_order
  )
  RETURNING marketing_tasks.id INTO v_new_id;

  IF v_assignee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, scope)
    VALUES (
      v_assignee_id,
      'Solicitação atribuída a você',
      'Você foi atribuído(a) automaticamente à solicitação "' || p_title || '" de ' || p_requester_name || '.',
      'task_assigned',
      '/marketing/solicitacoes?task=' || v_new_id::text,
      'marketing'
    );
  END IF;

  RETURN QUERY SELECT v_new_id, v_assignee_id, COALESCE(v_assignee_name, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_marketing_task(text, text, text, uuid, text, uuid) TO anon, authenticated, service_role;
