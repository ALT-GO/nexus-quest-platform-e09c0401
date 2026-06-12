
CREATE TABLE IF NOT EXISTS public.category_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_checklist_templates TO authenticated;
GRANT ALL ON public.category_checklist_templates TO service_role;

ALTER TABLE public.category_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authenticated can read templates"
  ON public.category_checklist_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin or ti can insert templates"
  ON public.category_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'ti'::app_role));

CREATE POLICY "admin or ti can update templates"
  ON public.category_checklist_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'ti'::app_role));

CREATE POLICY "admin or ti can delete templates"
  ON public.category_checklist_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'ti'::app_role));

CREATE OR REPLACE FUNCTION public.touch_checklist_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_checklist_templates ON public.category_checklist_templates;
CREATE TRIGGER trg_touch_checklist_templates
  BEFORE UPDATE ON public.category_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_checklist_templates_updated_at();

-- Seed defaults
INSERT INTO public.category_checklist_templates (category, items) VALUES
('Desligamento', jsonb_build_array(
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
)),
('Contratação', jsonb_build_array(
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
))
ON CONFLICT (category) DO NOTHING;

-- Replace trigger function to read from the templates table
CREATE OR REPLACE FUNCTION public.apply_category_checklist()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF NEW.category IS NULL THEN RETURN NEW; END IF;

  IF NEW.checklist IS NULL OR NEW.checklist::text = 'null'
     OR jsonb_array_length(COALESCE(NEW.checklist, '[]'::jsonb)) = 0 THEN
    SELECT items INTO v_items
    FROM public.category_checklist_templates
    WHERE category = NEW.category
    LIMIT 1;

    IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
      NEW.checklist := v_items;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_category_checklist ON public.tickets;
CREATE TRIGGER trg_apply_category_checklist
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_category_checklist();
