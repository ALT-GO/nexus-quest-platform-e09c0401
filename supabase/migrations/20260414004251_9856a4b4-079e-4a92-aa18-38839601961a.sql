
-- =============================================
-- 1. TICKETS - restrict access
-- =============================================
DROP POLICY IF EXISTS "Anyone can read tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can create tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can delete tickets" ON tickets;

-- Authenticated users can read all tickets
CREATE POLICY "Authenticated can read tickets" ON tickets
  FOR SELECT TO authenticated USING (true);

-- Anon + authenticated can create tickets (public form)
CREATE POLICY "Anyone can create tickets" ON tickets
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only TI/Admin can update tickets
CREATE POLICY "TI and Admin can update tickets" ON tickets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

-- Only Admin can delete tickets
CREATE POLICY "Admin can delete tickets" ON tickets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 2. INVENTORY - restrict to authenticated TI/Admin
-- =============================================
DROP POLICY IF EXISTS "Anyone can read inventory" ON inventory;
DROP POLICY IF EXISTS "Anyone can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Anyone can update inventory" ON inventory;
DROP POLICY IF EXISTS "Anyone can delete inventory" ON inventory;

CREATE POLICY "Authenticated can read inventory" ON inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "TI and Admin can insert inventory" ON inventory
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can update inventory" ON inventory
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can delete inventory" ON inventory
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

-- =============================================
-- 3. STATUS_CONFIG - public read, admin/TI write
-- =============================================
DROP POLICY IF EXISTS "Anyone can read status_config" ON status_config;
DROP POLICY IF EXISTS "Anyone can insert status_config" ON status_config;
DROP POLICY IF EXISTS "Anyone can update status_config" ON status_config;
DROP POLICY IF EXISTS "Anyone can delete status_config" ON status_config;

-- Keep public read (needed for public ticket form status resolution)
CREATE POLICY "Anyone can read status_config" ON status_config
  FOR SELECT USING (true);

CREATE POLICY "TI and Admin can insert status_config" ON status_config
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can update status_config" ON status_config
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "Admin can delete status_config" ON status_config
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 4. CUSTOM_FIELDS - restrict to authenticated TI/Admin
-- =============================================
DROP POLICY IF EXISTS "Anyone can read custom_fields" ON custom_fields;
DROP POLICY IF EXISTS "Anyone can insert custom_fields" ON custom_fields;
DROP POLICY IF EXISTS "Anyone can update custom_fields" ON custom_fields;
DROP POLICY IF EXISTS "Anyone can delete custom_fields" ON custom_fields;

CREATE POLICY "Authenticated can read custom_fields" ON custom_fields
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "TI and Admin can insert custom_fields" ON custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can update custom_fields" ON custom_fields
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can delete custom_fields" ON custom_fields
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

-- =============================================
-- 5. CUSTOM_FIELD_VALUES - restrict to authenticated TI/Admin
-- =============================================
DROP POLICY IF EXISTS "Anyone can read custom_field_values" ON custom_field_values;
DROP POLICY IF EXISTS "Anyone can insert custom_field_values" ON custom_field_values;
DROP POLICY IF EXISTS "Anyone can update custom_field_values" ON custom_field_values;
DROP POLICY IF EXISTS "Anyone can delete custom_field_values" ON custom_field_values;

CREATE POLICY "Authenticated can read custom_field_values" ON custom_field_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "TI and Admin can insert custom_field_values" ON custom_field_values
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can update custom_field_values" ON custom_field_values
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

CREATE POLICY "TI and Admin can delete custom_field_values" ON custom_field_values
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));

-- =============================================
-- 6. TICKET_COMMENTS - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Anyone can read comments" ON ticket_comments;
DROP POLICY IF EXISTS "Anyone can insert comments" ON ticket_comments;

CREATE POLICY "Authenticated can read comments" ON ticket_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert comments" ON ticket_comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 7. TICKET_HISTORY - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Anyone can read history" ON ticket_history;
DROP POLICY IF EXISTS "Anyone can insert history" ON ticket_history;

CREATE POLICY "Authenticated can read history" ON ticket_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert history" ON ticket_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 8. TIMESHEET_LOGS - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Anyone can read timesheet_logs" ON timesheet_logs;
DROP POLICY IF EXISTS "Anyone can insert timesheet_logs" ON timesheet_logs;
DROP POLICY IF EXISTS "Anyone can update timesheet_logs" ON timesheet_logs;
DROP POLICY IF EXISTS "Anyone can delete timesheet_logs" ON timesheet_logs;

CREATE POLICY "Authenticated can read timesheet_logs" ON timesheet_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert timesheet_logs" ON timesheet_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update timesheet_logs" ON timesheet_logs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete timesheet_logs" ON timesheet_logs
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- 9. Fix mutable search_path on functions
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_timesheet_log_reference()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
BEGIN
  IF NEW.ticket_id IS NULL AND NEW.marketing_task_id IS NULL THEN
    RAISE EXCEPTION 'Either ticket_id or marketing_task_id must be set';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(ticket_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.tickets
  WHERE ticket_number LIKE 'TI-' || current_year || '-%';
  
  NEW.ticket_number := 'TI-' || current_year || '-' || lpad(next_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_asset_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
DECLARE
  prefix TEXT;
  next_seq INTEGER;
BEGIN
  CASE NEW.category
    WHEN 'notebooks' THEN prefix := 'NB';
    WHEN 'celulares' THEN prefix := 'CEL';
    WHEN 'tablets' THEN prefix := 'TAB';
    WHEN 'perifericos' THEN prefix := 'PER';
    WHEN 'linhas' THEN prefix := 'LIN';
    WHEN 'licencas' THEN prefix := 'LIC';
    WHEN 'hardware' THEN prefix := 'HW';
    WHEN 'passwords' THEN prefix := 'PW';
    WHEN 'telecom' THEN prefix := 'TEL';
    WHEN 'licenses' THEN prefix := 'LIC';
    ELSE prefix := 'AST';
  END CASE;
  
  SELECT COALESCE(MAX(
    CAST(split_part(asset_code, '-', 2) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.inventory
  WHERE asset_code LIKE prefix || '-%';
  
  NEW.asset_code := prefix || '-' || lpad(next_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;
