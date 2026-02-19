
-- Deny anonymous access to profiles table
CREATE POLICY "deny_anonymous_access_profiles" ON public.profiles FOR ALL TO anon USING (false);

-- Deny anonymous access to invitations table
CREATE POLICY "deny_anonymous_access_invitations" ON public.invitations FOR ALL TO anon USING (false);
