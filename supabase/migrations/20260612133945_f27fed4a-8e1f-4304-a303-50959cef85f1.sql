CREATE OR REPLACE FUNCTION public.apply_category_checklist()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category = 'Desligamento'
     AND (NEW.checklist IS NULL OR NEW.checklist::text = 'null' OR jsonb_array_length(COALESCE(NEW.checklist, '[]'::jsonb)) = 0) THEN
    NEW.checklist := jsonb_build_array(
      jsonb_build_object('text','Bloqueio facial','checked',false),
      jsonb_build_object('text','Perguntar ao gestor sobre direcionamento e backup e-mail','checked',false),
      jsonb_build_object('text','Solicitar bloqueio e-mail + comentar planilha','checked',false),
      jsonb_build_object('text','Bloqueio helpdesk feito + comentar planilha','checked',false),
      jsonb_build_object('text','Desvincular o e-mail do colaborador','checked',false),
      jsonb_build_object('text','Pôr data do bloqueio e alterar status para "desligado"','checked',false),
      jsonb_build_object('text','Gerar termo de devolução','checked',false),
      jsonb_build_object('text','Salvar termo de devolução assinado na pasta','checked',false),
      jsonb_build_object('text','Desvincular demais itens do colaborador (se houver)','checked',false),
      jsonb_build_object('text','Inventariar itens devolvidos (se houver)','checked',false),
      jsonb_build_object('text','Apagar RMM e Bitdefender (se houver)','checked',false),
      jsonb_build_object('text','Retirar Family Link (se houver)','checked',false)
    );
  END IF;

  IF NEW.category = 'Contratação'
     AND (NEW.checklist IS NULL OR NEW.checklist::text = 'null' OR jsonb_array_length(COALESCE(NEW.checklist, '[]'::jsonb)) = 0) THEN
    NEW.checklist := jsonb_build_array(
      jsonb_build_object('text','Perguntar se os itens estão corretos','checked',false),
      jsonb_build_object('text','Itens confirmados pelo gestor','checked',false),
      jsonb_build_object('text','Solicitar e-mail 3 dias antes do início (se houver)','checked',false),
      jsonb_build_object('text','Inventariar e-mail na planilha + hub (se houver)','checked',false),
      jsonb_build_object('text','Enviar e-mail de boas-vindas (se houver)','checked',false),
      jsonb_build_object('text','Checar película e capinha protetora no celular (se houver)','checked',false),
      jsonb_build_object('text','Fazer checklist do celular (se houver)','checked',false),
      jsonb_build_object('text','Configurar e inventariar Family Link (se houver)','checked',false),
      jsonb_build_object('text','Baixar apps padrão no celular (se houver)','checked',false),
      jsonb_build_object('text','Resetar WhatsApp (se houver)','checked',false),
      jsonb_build_object('text','Testar TeamViewer','checked',false),
      jsonb_build_object('text','Inventariar chip (se atentar ao CC) (se houver)','checked',false),
      jsonb_build_object('text','Fazer checklist do notebook (se houver)','checked',false),
      jsonb_build_object('text','Formatar notebook (se houver)','checked',false),
      jsonb_build_object('text','Fazer todas as configurações no notebook (se houver)','checked',false),
      jsonb_build_object('text','Inventariar periféricos do notebook e/ou celular (se houver)','checked',false),
      jsonb_build_object('text','Gerar termo de responsabilidade e colocar na pasta para assinatura','checked',false),
      jsonb_build_object('text','Salvar termo de responsabilidade assinado na pasta','checked',false),
      jsonb_build_object('text','Cadastrar facial','checked',false)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_desligamento_checklist ON public.tickets;
CREATE TRIGGER trg_apply_category_checklist
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.apply_category_checklist();