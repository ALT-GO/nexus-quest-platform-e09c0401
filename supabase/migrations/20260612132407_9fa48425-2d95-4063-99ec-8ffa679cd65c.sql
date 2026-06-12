
CREATE OR REPLACE FUNCTION public.apply_desligamento_checklist()
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_desligamento_checklist ON public.tickets;
CREATE TRIGGER trg_apply_desligamento_checklist
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.apply_desligamento_checklist();
