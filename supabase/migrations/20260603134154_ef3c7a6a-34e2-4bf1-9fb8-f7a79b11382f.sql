CREATE OR REPLACE FUNCTION public.create_public_marketing_task(p_title text, p_description text, p_requester_name text, p_requester_id uuid DEFAULT NULL::uuid, p_priority text DEFAULT 'medium'::text, p_assignee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, assignee_id uuid, assignee_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id uuid;
  v_next_order int;
  v_new_id uuid;
  v_assignee_id uuid := p_assignee_id;
  v_assignee_name text := '';
BEGIN
  SELECT ms.id INTO v_stage_id FROM public.marketing_stages ms ORDER BY ms.order_index LIMIT 1;
  SELECT COALESCE(MAX(mt.order_index), -1) + 1 INTO v_next_order FROM public.marketing_tasks mt;

  IF v_assignee_id IS NULL THEN
    SELECT rr.user_id, rr.full_name
      INTO v_assignee_id, v_assignee_name
    FROM public.pick_round_robin_assignee(ARRAY['marketing','admin']::app_role[]) rr;
  ELSE
    SELECT p.full_name INTO v_assignee_name FROM public.profiles p WHERE p.id = v_assignee_id;
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
$function$;