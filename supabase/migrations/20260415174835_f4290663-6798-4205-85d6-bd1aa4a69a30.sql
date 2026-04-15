CREATE POLICY "Anon can insert notifications"
ON public.notifications
FOR INSERT
TO anon
WITH CHECK (true);