
-- Fix: Change all RESTRICTIVE policies to PERMISSIVE for households
DROP POLICY IF EXISTS "Users can view own household" ON public.households;
DROP POLICY IF EXISTS "Users can create household" ON public.households;
DROP POLICY IF EXISTS "Admins can update household" ON public.households;

CREATE POLICY "Users can view own household" ON public.households
FOR SELECT USING (is_household_member(auth.uid(), id));

CREATE POLICY "Users can create household" ON public.households
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update household" ON public.households
FOR UPDATE USING ((get_household_role(auth.uid(), id))::text = 'admin'::text);

-- Fix household_members INSERT policy too
DROP POLICY IF EXISTS "Users can insert own membership" ON public.household_members;
DROP POLICY IF EXISTS "Users can view members of own household" ON public.household_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.household_members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.household_members;

CREATE POLICY "Users can view members of own household" ON public.household_members
FOR SELECT USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert own membership" ON public.household_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage members" ON public.household_members
FOR UPDATE USING ((get_household_role(auth.uid(), household_id))::text = 'admin'::text);

CREATE POLICY "Admins can delete members" ON public.household_members
FOR DELETE USING (((get_household_role(auth.uid(), household_id))::text = 'admin'::text) OR (user_id = auth.uid()));

-- Fix profiles policies too
DROP POLICY IF EXISTS "Users can view profiles in same household" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in same household" ON public.profiles
FOR SELECT USING ((id = auth.uid()) OR is_household_member(id, get_user_household_id(auth.uid())));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());

-- Fix other tables too
DROP POLICY IF EXISTS "Users can manage household accounts" ON public.accounts;
CREATE POLICY "Users can manage household accounts" ON public.accounts
FOR ALL USING (is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Users can manage household budgets" ON public.budgets;
CREATE POLICY "Users can manage household budgets" ON public.budgets
FOR ALL USING (is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Users can manage household categories" ON public.categories;
CREATE POLICY "Users can manage household categories" ON public.categories
FOR ALL USING ((household_id IS NULL) OR is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Anyone can read exchange rates" ON public.exchange_rates;
CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rates
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage household transactions" ON public.transactions;
CREATE POLICY "Users can manage household transactions" ON public.transactions
FOR ALL USING (is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Users can manage household savings goals" ON public.savings_goals;
CREATE POLICY "Users can manage household savings goals" ON public.savings_goals
FOR ALL USING (is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Users can manage household savings deposits" ON public.savings_deposits;
CREATE POLICY "Users can manage household savings deposits" ON public.savings_deposits
FOR ALL USING (is_household_member(auth.uid(), household_id));

-- Fix invitations
DROP POLICY IF EXISTS "Users can view own household invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can update invitations sent to them" ON public.invitations;

CREATE POLICY "Users can view own household invitations" ON public.invitations
FOR SELECT USING (is_household_member(auth.uid(), household_id) OR (email::text = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())::text));

CREATE POLICY "Admins can create invitations" ON public.invitations
FOR INSERT WITH CHECK ((get_household_role(auth.uid(), household_id))::text = 'admin'::text);

CREATE POLICY "Users can update invitations sent to them" ON public.invitations
FOR UPDATE USING ((email::text = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())::text));
