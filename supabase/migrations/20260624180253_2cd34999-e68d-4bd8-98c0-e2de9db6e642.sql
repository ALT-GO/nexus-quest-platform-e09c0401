
-- Fix 1: ticket_number generator truncates "1000" to "100" via lpad(_, 3).
-- Use GREATEST so numbers >= 1000 keep their full width.
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
  seq_text TEXT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(ticket_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.tickets
  WHERE ticket_number LIKE 'TI-' || current_year || '-%';

  seq_text := next_seq::TEXT;
  NEW.ticket_number := 'TI-' || current_year || '-' || lpad(seq_text, GREATEST(3, length(seq_text)), '0');
  RETURN NEW;
END;
$function$;

-- Fix 2: drop the old 9-arg overload so PostgREST can resolve the RPC unambiguously.
DROP FUNCTION IF EXISTS public.create_public_ticket(
  text, text, text, text, text, text, text, uuid, timestamptz
);
