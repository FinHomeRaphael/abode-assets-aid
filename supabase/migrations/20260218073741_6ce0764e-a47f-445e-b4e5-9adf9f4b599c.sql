
-- Recreate INSERT policy explicitly for authenticated role
DROP POLICY IF EXISTS "Users can create household" ON public.households;
CREATE POLICY "Users can create household" ON public.households
FOR INSERT TO authenticated
WITH CHECK (true);
