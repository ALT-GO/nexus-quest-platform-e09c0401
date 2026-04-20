-- Backfill notification links so existing overdue/assignment notifications open the related task
UPDATE notifications n
SET link = '/marketing/solicitacoes?task=' || t.id
FROM marketing_tasks t
WHERE n.link = '/marketing/solicitacoes'
  AND n.title LIKE 'Tarefa atrasada: %'
  AND n.title = 'Tarefa atrasada: ' || t.title;

UPDATE notifications n
SET link = '/marketing/solicitacoes?task=' || t.id
FROM marketing_tasks t
WHERE n.link = '/marketing/solicitacoes'
  AND n.title = 'Nova tarefa automática'
  AND n.message = 'Tarefa "' || t.title || '" criada automaticamente.';

UPDATE notifications n
SET link = '/marketing/eventos?event=' || e.id
FROM marketing_events e
WHERE n.link = '/marketing/eventos'
  AND n.title = 'Lembrete de evento: ' || e.name;