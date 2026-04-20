ALTER TABLE public.inventory_status_config REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_status_config;