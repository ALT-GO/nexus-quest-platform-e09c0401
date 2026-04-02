CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role app_role;
  _perms jsonb;
BEGIN
  -- Default permissions
  _perms := '{"criar_chamados": true, "atender_chamados": false, "gerenciar_estoque": false, "ver_custos_faturas": false, "acesso_admin_global": false, "acessar_cofre_senhas": false, "acessar_kanban_marketing": false, "ver_dashboard_financeiro": false, "ver_dashboard": true, "ver_central_inteligencia": false, "ver_service_desk": true, "ver_colaboradores": false, "ver_gestao_custos": false, "ver_cofre_senhas": false, "ver_solicitacoes_marketing": false, "ver_eventos_marketing": false, "ver_metas_marketing": false}'::jsonb;

  -- Check if there's an invite for this email
  IF EXISTS (SELECT 1 FROM public.user_invites WHERE email = NEW.email AND accepted_at IS NULL) THEN
    SELECT ui.role INTO _role FROM public.user_invites ui WHERE ui.email = NEW.email AND ui.accepted_at IS NULL LIMIT 1;
    
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
    UPDATE public.user_invites SET accepted_at = now() WHERE email = NEW.email AND accepted_at IS NULL;

    -- Apply role-based permission presets
    IF _role = 'admin' THEN
      _perms := '{"criar_chamados": true, "atender_chamados": true, "gerenciar_estoque": true, "ver_custos_faturas": true, "acesso_admin_global": true, "acessar_cofre_senhas": true, "acessar_kanban_marketing": true, "ver_dashboard_financeiro": true, "ver_dashboard": true, "ver_central_inteligencia": true, "ver_service_desk": true, "ver_colaboradores": true, "ver_gestao_custos": true, "ver_cofre_senhas": true, "ver_solicitacoes_marketing": true, "ver_eventos_marketing": true, "ver_metas_marketing": true}'::jsonb;
    ELSIF _role = 'ti' THEN
      _perms := '{"criar_chamados": true, "atender_chamados": true, "gerenciar_estoque": true, "ver_custos_faturas": true, "acesso_admin_global": false, "acessar_cofre_senhas": true, "acessar_kanban_marketing": false, "ver_dashboard_financeiro": true, "ver_dashboard": true, "ver_central_inteligencia": true, "ver_service_desk": true, "ver_colaboradores": true, "ver_gestao_custos": true, "ver_cofre_senhas": true, "ver_solicitacoes_marketing": false, "ver_eventos_marketing": false, "ver_metas_marketing": false}'::jsonb;
    ELSIF _role = 'marketing' THEN
      _perms := '{"criar_chamados": true, "atender_chamados": false, "gerenciar_estoque": false, "ver_custos_faturas": false, "acesso_admin_global": false, "acessar_cofre_senhas": false, "acessar_kanban_marketing": true, "ver_dashboard_financeiro": false, "ver_dashboard": true, "ver_central_inteligencia": true, "ver_service_desk": true, "ver_colaboradores": false, "ver_gestao_custos": false, "ver_cofre_senhas": false, "ver_solicitacoes_marketing": true, "ver_eventos_marketing": true, "ver_metas_marketing": true}'::jsonb;
    END IF;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador');
  END IF;

  INSERT INTO public.profiles (id, full_name, permissions)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _perms);

  RETURN NEW;
END;
$$;