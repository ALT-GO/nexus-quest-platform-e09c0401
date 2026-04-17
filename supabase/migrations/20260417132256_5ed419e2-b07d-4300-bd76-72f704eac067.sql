-- Bot settings table: per-event configuration for Sr. Bot
CREATE TABLE IF NOT EXISTS public.bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  channel_id uuid REFERENCES public.chat_channels(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read bot_settings" ON public.bot_settings;
CREATE POLICY "Authenticated can read bot_settings"
ON public.bot_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can insert bot_settings" ON public.bot_settings;
CREATE POLICY "Admin can insert bot_settings"
ON public.bot_settings FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can update bot_settings" ON public.bot_settings;
CREATE POLICY "Admin can update bot_settings"
ON public.bot_settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can delete bot_settings" ON public.bot_settings;
CREATE POLICY "Admin can delete bot_settings"
ON public.bot_settings FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bot_settings_updated_at
BEFORE UPDATE ON public.bot_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_updated_at();

-- Seed default events pointing to #chamados-ti when present
INSERT INTO public.bot_settings (event_key, enabled, channel_id)
SELECT k.event_key, true, (SELECT id FROM public.chat_channels WHERE name = 'chamados-ti' LIMIT 1)
FROM (VALUES
  ('ticket_created'),
  ('sla_near'),
  ('sla_expired'),
  ('ticket_completed')
) AS k(event_key)
ON CONFLICT (event_key) DO NOTHING;