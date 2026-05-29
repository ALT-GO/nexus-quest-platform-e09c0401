
CREATE OR REPLACE FUNCTION public.create_public_ticket(
  p_title text,
  p_category text,
  p_description text,
  p_requester text,
  p_email text,
  p_department text DEFAULT NULL,
  p_priority text DEFAULT 'medium'
)
RETURNS TABLE(id uuid, ticket_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_sla_hours int := 24;
  v_sla_deadline timestamptz;
  v_new_id uuid;
  v_new_number text;
BEGIN
  v_target_column := COALESCE(v_category_map ->> p_category, 'Novos Chamados');

  SELECT sc.id INTO v_status_id
  FROM public.status_config sc
  WHERE sc.nome = v_target_column
  LIMIT 1;

  IF v_status_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem FROM public.status_config;
    v_status_id := 'auto_' || regexp_replace(lower(v_target_column), '[^a-z0-9]', '_', 'g') || '_' || extract(epoch from now())::bigint;
    INSERT INTO public.status_config (id, nome, cor, ordem, ativo, is_final, status_type)
    VALUES (v_status_id, v_target_column, '221 83% 53%', v_max_ordem + 1, true, false, 'todo');
  END IF;

  SELECT sla_hours INTO v_sla_hours
  FROM public.sla_categories
  WHERE category = p_category
  LIMIT 1;
  v_sla_hours := COALESCE(v_sla_hours, 24);
  v_sla_deadline := now() + (v_sla_hours || ' hours')::interval;

  INSERT INTO public.tickets (
    title, category, description, requester, email, department,
    priority, status_id, sla_hours, sla_deadline, ticket_number
  ) VALUES (
    COALESCE(NULLIF(p_title, ''), p_category),
    p_category, p_description, p_requester, p_email, NULLIF(p_department, ''),
    COALESCE(p_priority, 'medium'), v_status_id, v_sla_hours, v_sla_deadline, ''
  )
  RETURNING tickets.id, tickets.ticket_number INTO v_new_id, v_new_number;

  RETURN QUERY SELECT v_new_id, v_new_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_ticket(text, text, text, text, text, text, text) TO anon, authenticated;
