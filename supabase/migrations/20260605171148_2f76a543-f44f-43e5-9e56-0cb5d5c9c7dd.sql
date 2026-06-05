UPDATE public.tickets SET status_id = CASE
  WHEN category IN ('Solicitação de novo Computador/Notebook', 'Solicitação de Notebook') THEN 'waitingUser'
  WHEN category IN ('Solicitação de novo Celular', 'Solicitação de Celular', 'Problemas com Celular') THEN 'custom_1773003490486'
  WHEN category = 'Solicitação de nova Linha' THEN 'completed'
  WHEN category = 'Contratação' THEN 'pending'
  WHEN category = 'Desligamento' THEN 'inProgress'
  ELSE 'cancelled'
END
WHERE status_id = 'done';