
-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view own household invitations" ON public.invitations;

-- Create a more restrictive SELECT policy: only admins and the invited user
CREATE POLICY "Users can view own household invitations"
ON public.invitations
FOR SELECT
USING (
  (get_household_role(auth.uid(), household_id))::text = 'admin'::text
  OR (email)::text = (SELECT email FROM public.profiles WHERE id = auth.uid())::text
);
