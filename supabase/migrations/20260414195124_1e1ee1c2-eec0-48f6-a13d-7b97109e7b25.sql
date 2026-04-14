CREATE POLICY "Anon can read tickets" 
ON public.tickets 
FOR SELECT 
TO anon
USING (true);
