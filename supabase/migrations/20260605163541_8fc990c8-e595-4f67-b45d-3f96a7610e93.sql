-- Add 10 business days helper inline via generate_series
UPDATE public.tickets
SET sla_deadline = completed_at + interval '1 day',
    sla_expired = false,
    updated_at = now()
WHERE created_at >= '2026-04-01'::timestamptz
  AND completed_at IS NOT NULL;

-- For open tickets: 10 business days after created_at
WITH open_tix AS (
  SELECT t.id, t.created_at,
    (
      SELECT MAX(d)
      FROM (
        SELECT generate_series(
          (t.created_at::date) + 1,
          (t.created_at::date) + 30,
          interval '1 day'
        )::date AS d
      ) s
      WHERE extract(dow FROM s.d) NOT IN (0,6)
      LIMIT 1
    ) AS dummy
  FROM public.tickets t
  WHERE t.created_at >= '2026-04-01'::timestamptz
    AND t.completed_at IS NULL
),
calc AS (
  SELECT t.id,
    (
      SELECT d FROM (
        SELECT d, row_number() OVER (ORDER BY d) AS rn
        FROM (
          SELECT generate_series(
            (t.created_at::date) + 1,
            (t.created_at::date) + 40,
            interval '1 day'
          )::date AS d
        ) s
        WHERE extract(dow FROM s.d) NOT IN (0,6)
      ) x WHERE rn = 10
    ) AS deadline_date
  FROM public.tickets t
  WHERE t.created_at >= '2026-04-01'::timestamptz
    AND t.completed_at IS NULL
)
UPDATE public.tickets t
SET sla_deadline = (calc.deadline_date + time '18:00')::timestamptz,
    sla_expired = false,
    updated_at = now()
FROM calc
WHERE t.id = calc.id;