-- 1. Expandir suporte de category_group em inventory_status_config para incluir Condição (hardware)
--    e separar Status entre Linhas e Licenças.
--    Grupos: 'condition_hardware' (Notebooks/Celulares/Tablets/Periféricos - campo "Condição")
--            'status_linhas'      (Linhas - campo "Status")
--            'status_licencas'    (Licenças - campo "Status")
--    Mantemos 'hardware' e 'software' antigos por compat (serão migrados para os novos).

-- 1a. Migrar registros antigos
UPDATE public.inventory_status_config
SET category_group = 'status_licencas'
WHERE category_group = 'software';

-- Os registros 'hardware' antigos representavam o campo Status duplicado que vamos remover dos hardware.
-- Vamos preservá-los como condition_hardware caso o admin tenha cadastrado coisas customizadas,
-- mas só se ainda não houver entradas equivalentes.
UPDATE public.inventory_status_config
SET category_group = 'condition_hardware'
WHERE category_group = 'hardware';

-- 1b. Seed das CONDIÇÕES de hardware (valores que já existiam hardcoded)
INSERT INTO public.inventory_status_config (category_group, name, color, order_index, is_active)
SELECT 'condition_hardware', v.name, v.color, v.ord, true
FROM (VALUES
  ('Pronto para uso', '152 69% 31%', 1),
  ('Em manutenção',   '38 92% 50%',  2),
  ('Bloqueado',       '0 84% 60%',   3),
  ('Sucata',          '220 9% 46%',  4),
  ('Defeito',         '0 84% 60%',   5)
) AS v(name, color, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_status_config c
  WHERE c.category_group = 'condition_hardware' AND lower(c.name) = lower(v.name)
);

-- 1c. Seed dos STATUS de Linhas (preservando valores reais do banco)
INSERT INTO public.inventory_status_config (category_group, name, color, order_index, is_active)
SELECT 'status_linhas', v.name, v.color, v.ord, true
FROM (VALUES
  ('Disponível', '152 69% 31%', 1),
  ('Em uso',     '217 91% 60%', 2),
  ('Bloqueada',  '0 84% 60%',   3),
  ('Cancelada',  '220 9% 46%',  4)
) AS v(name, color, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_status_config c
  WHERE c.category_group = 'status_linhas' AND lower(c.name) = lower(v.name)
);

-- 1d. Seed dos STATUS de Licenças (preservando valores reais do banco)
INSERT INTO public.inventory_status_config (category_group, name, color, order_index, is_active)
SELECT 'status_licencas', v.name, v.color, v.ord, true
FROM (VALUES
  ('Ativo',     '152 69% 31%', 1),
  ('Inativo',   '220 9% 46%',  2),
  ('Desligado', '0 84% 60%',   3)
) AS v(name, color, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_status_config c
  WHERE c.category_group = 'status_licencas' AND lower(c.name) = lower(v.name)
);

-- 2. Migrar dados existentes na tabela inventory.condition (que estava em inglês) para os labels em PT
--    Isso permite que o select dinâmico (que usa nomes em PT vindos da config) bata com o valor salvo.
UPDATE public.inventory SET condition = 'Pronto para uso' WHERE condition = 'ready';
UPDATE public.inventory SET condition = 'Em manutenção'   WHERE condition = 'maintenance';
UPDATE public.inventory SET condition = 'Bloqueado'       WHERE condition = 'blocked';
UPDATE public.inventory SET condition = 'Sucata'          WHERE condition = 'scrap';