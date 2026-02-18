
-- ==========================================
-- FineHome Database Schema
-- ==========================================

-- 1. HOUSEHOLDS
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  default_currency VARCHAR(3) DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HOUSEHOLD_MEMBERS (join table with role - keeps roles separate from profiles)
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- 4. CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ACCOUNTS
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('courant', 'epargne', 'cash', 'carte', 'autre')),
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  starting_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  starting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  label VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  exchange_rate DECIMAL(10,6) NOT NULL DEFAULT 1,
  base_currency VARCHAR(3) NOT NULL,
  converted_amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL DEFAULT '📌',
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  date DATE NOT NULL,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_day INTEGER,
  recurring_source_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  recurring_start_month VARCHAR(7),
  recurring_end_month VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_household ON public.transactions(household_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_recurring ON public.transactions(is_recurring, recurring_start_month, recurring_end_month);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);

-- 7. BUDGETS
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  category VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL DEFAULT '📌',
  limit_amount DECIMAL(12,2) NOT NULL,
  period VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  alerts_enabled BOOLEAN DEFAULT TRUE,
  is_recurring BOOLEAN DEFAULT TRUE,
  month_year VARCHAR(7),
  start_month VARCHAR(7) NOT NULL,
  end_month VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budgets_household ON public.budgets(household_id);

-- 8. SAVINGS_GOALS
CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  target_date DATE,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_savings_goals_household ON public.savings_goals(household_id);

-- 9. SAVINGS_DEPOSITS
CREATE TABLE public.savings_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_savings_deposits_goal ON public.savings_deposits(goal_id);
CREATE INDEX idx_savings_deposits_date ON public.savings_deposits(date);

-- 10. EXCHANGE_RATES
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(base_currency, target_currency)
);

-- 11. INVITATIONS
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- ==========================================
-- SECURITY DEFINER FUNCTION (avoid RLS recursion)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_user_household_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members WHERE user_id = _user_id AND household_id = _household_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_household_role(_user_id UUID, _household_id UUID)
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.household_members WHERE user_id = _user_id AND household_id = _household_id
$$;

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in same household" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    public.is_household_member(id, public.get_user_household_id(auth.uid()))
  );

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- HOUSEHOLDS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household" ON public.households
  FOR SELECT USING (public.is_household_member(auth.uid(), id));

CREATE POLICY "Users can create household" ON public.households
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update household" ON public.households
  FOR UPDATE USING (public.get_household_role(auth.uid(), id) = 'admin');

-- HOUSEHOLD_MEMBERS
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of own household" ON public.household_members
  FOR SELECT USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert own membership" ON public.household_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage members" ON public.household_members
  FOR UPDATE USING (public.get_household_role(auth.uid(), household_id) = 'admin');

CREATE POLICY "Admins can delete members" ON public.household_members
  FOR DELETE USING (public.get_household_role(auth.uid(), household_id) = 'admin' OR user_id = auth.uid());

-- CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household categories" ON public.categories
  FOR ALL USING (
    household_id IS NULL OR public.is_household_member(auth.uid(), household_id)
  );

-- ACCOUNTS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household accounts" ON public.accounts
  FOR ALL USING (public.is_household_member(auth.uid(), household_id));

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household transactions" ON public.transactions
  FOR ALL USING (public.is_household_member(auth.uid(), household_id));

-- BUDGETS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household budgets" ON public.budgets
  FOR ALL USING (public.is_household_member(auth.uid(), household_id));

-- SAVINGS_GOALS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household savings goals" ON public.savings_goals
  FOR ALL USING (public.is_household_member(auth.uid(), household_id));

-- SAVINGS_DEPOSITS
ALTER TABLE public.savings_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage household savings deposits" ON public.savings_deposits
  FOR ALL USING (public.is_household_member(auth.uid(), household_id));

-- EXCHANGE_RATES (public read, no write from client)
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rates
  FOR SELECT USING (true);

-- INVITATIONS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household invitations" ON public.invitations
  FOR SELECT USING (
    public.is_household_member(auth.uid(), household_id)
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    public.get_household_role(auth.uid(), household_id) = 'admin'
  );

CREATE POLICY "Users can update invitations sent to them" ON public.invitations
  FOR UPDATE USING (
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON public.savings_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- INSERT DEFAULT CATEGORIES WHEN HOUSEHOLD IS CREATED
-- ==========================================
CREATE OR REPLACE FUNCTION public.insert_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (household_id, name, emoji, type, is_default) VALUES
    (NEW.id, 'Alimentation', '🛒', 'expense', true),
    (NEW.id, 'Logement', '🏠', 'expense', true),
    (NEW.id, 'Transport', '🚗', 'expense', true),
    (NEW.id, 'Santé', '💊', 'expense', true),
    (NEW.id, 'Loisirs', '🎮', 'expense', true),
    (NEW.id, 'Shopping', '🛍️', 'expense', true),
    (NEW.id, 'Abonnements', '📱', 'expense', true),
    (NEW.id, 'Éducation', '📚', 'expense', true),
    (NEW.id, 'Voyages', '✈️', 'expense', true),
    (NEW.id, 'Restaurants', '🍽️', 'expense', true),
    (NEW.id, 'Services', '🔧', 'expense', true),
    (NEW.id, 'Impôts', '📋', 'expense', true),
    (NEW.id, 'Autre', '📦', 'expense', true),
    (NEW.id, 'Salaire', '💰', 'income', true),
    (NEW.id, 'Freelance', '💻', 'income', true),
    (NEW.id, 'Investissement', '📈', 'income', true),
    (NEW.id, 'Allocation', '🏛️', 'income', true),
    (NEW.id, 'Autre revenu', '💵', 'income', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_household_created
  AFTER INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.insert_default_categories();

-- ==========================================
-- DEFAULT EXCHANGE RATES
-- ==========================================
INSERT INTO public.exchange_rates (base_currency, target_currency, rate) VALUES
  ('EUR', 'EUR', 1.000000),
  ('EUR', 'USD', 1.085000),
  ('EUR', 'GBP', 0.855000),
  ('EUR', 'CHF', 0.950000),
  ('USD', 'EUR', 0.922000),
  ('USD', 'USD', 1.000000),
  ('USD', 'GBP', 0.788000),
  ('USD', 'CHF', 0.875000),
  ('GBP', 'EUR', 1.170000),
  ('GBP', 'USD', 1.269000),
  ('GBP', 'GBP', 1.000000),
  ('GBP', 'CHF', 1.111000),
  ('CHF', 'EUR', 1.053000),
  ('CHF', 'USD', 1.143000),
  ('CHF', 'GBP', 0.900000),
  ('CHF', 'CHF', 1.000000);
