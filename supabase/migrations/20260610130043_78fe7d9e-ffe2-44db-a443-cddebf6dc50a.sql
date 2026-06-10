DROP POLICY IF EXISTS "Admin can delete tickets" ON public.tickets;
CREATE POLICY "TI and Admin can delete tickets" ON public.tickets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ti'::app_role));