
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE
-- PostgreSQL requires at least one PERMISSIVE policy; RESTRICTIVE alone blocks everything

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view profiles in same household" ON public.profiles;
CREATE POLICY "Users can view profiles in same household" ON public.profiles
FOR SELECT TO authenticated USING ((id = auth.uid()) OR is_household_member(id, get_user_household_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- === HOUSEHOLDS ===
DROP POLICY IF EXISTS "Users can view own household" ON public.households;
CREATE POLICY "Users can view own household" ON public.households
FOR SELECT TO authenticated USING (is_household_member(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can update household" ON public.households;
CREATE POLICY "Admins can update household" ON public.households
FOR UPDATE TO authenticated USING (get_household_role(auth.uid(), id) = 'admin');

DROP POLICY IF EXISTS "Users can create household" ON public.households;
CREATE POLICY "Users can create household" ON public.households
FOR INSERT TO authenticated WITH CHECK (true);

-- === HOUSEHOLD_MEMBERS ===
DROP POLICY IF EXISTS "Users can view members of own household" ON public.household_members;
CREATE POLICY "Users can view members of own household" ON public.household_members
FOR SELECT TO authenticated USING (is_household_member(auth.uid(), household_id));

DROP POLICY IF EXISTS "Users can insert own membership" ON public.household_members;
CREATE POLICY "Users can insert own membership" ON public.household_members
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage members" ON public.household_members;
CREATE POLICY "Admins can manage members" ON public.household_members
FOR UPDATE TO authenticated USING (get_household_role(auth.uid(), household_id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete members" ON public.household_members;
CREATE POLICY "Admins can delete members" ON public.household_members
FOR DELETE TO authenticated USING (get_household_role(auth.uid(), household_id) = 'admin' OR user_id = auth.uid());

-- === ACCOUNTS ===
DROP POLICY IF EXISTS "Users can manage household accounts" ON public.accounts;
CREATE POLICY "Users can manage household accounts" ON public.accounts
FOR ALL TO authenticated USING (is_household_member(auth.uid(), household_id)) WITH CHECK (is_household_member(auth.uid(), household_id));

-- === TRANSACTIONS ===
DROP POLICY IF EXISTS "Users can manage household transactions" ON public.transactions;
CREATE POLICY "Users can manage household transactions" ON public.transactions
FOR ALL TO authenticated USING (is_household_member(auth.uid(), household_id)) WITH CHECK (is_household_member(auth.uid(), household_id));

-- === BUDGETS ===
DROP POLICY IF EXISTS "Users can manage household budgets" ON public.budgets;
CREATE POLICY "Users can manage household budgets" ON public.budgets
FOR ALL TO authenticated USING (is_household_member(auth.uid(), household_id)) WITH CHECK (is_household_member(auth.uid(), household_id));

-- === SAVINGS_GOALS ===
DROP POLICY IF EXISTS "Users can manage household savings goals" ON public.savings_goals;
CREATE POLICY "Users can manage household savings goals" ON public.savings_goals
FOR ALL TO authenticated USING (is_household_member(auth.uid(), household_id)) WITH CHECK (is_household_member(auth.uid(), household_id));

-- === SAVINGS_DEPOSITS ===
DROP POLICY IF EXISTS "Users can manage household savings deposits" ON public.savings_deposits;
CREATE POLICY "Users can manage household savings deposits" ON public.savings_deposits
FOR ALL TO authenticated USING (is_household_member(auth.uid(), household_id)) WITH CHECK (is_household_member(auth.uid(), household_id));

-- === CATEGORIES ===
DROP POLICY IF EXISTS "Users can manage household categories" ON public.categories;
CREATE POLICY "Users can manage household categories" ON public.categories
FOR ALL TO authenticated USING (household_id IS NULL OR is_household_member(auth.uid(), household_id)) WITH CHECK (household_id IS NULL OR is_household_member(auth.uid(), household_id));

-- === EXCHANGE_RATES ===
DROP POLICY IF EXISTS "Anyone can read exchange rates" ON public.exchange_rates;
CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rates
FOR SELECT USING (true);

-- === INVITATIONS ===
DROP POLICY IF EXISTS "Users can view own household invitations" ON public.invitations;
CREATE POLICY "Users can view own household invitations" ON public.invitations
FOR SELECT TO authenticated USING (is_household_member(auth.uid(), household_id) OR email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations" ON public.invitations
FOR INSERT TO authenticated WITH CHECK (get_household_role(auth.uid(), household_id) = 'admin');

DROP POLICY IF EXISTS "Users can update invitations sent to them" ON public.invitations;
CREATE POLICY "Users can update invitations sent to them" ON public.invitations
FOR UPDATE TO authenticated USING (email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()));

-- === Create missing trigger for auto-creating profiles on signup ===
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
