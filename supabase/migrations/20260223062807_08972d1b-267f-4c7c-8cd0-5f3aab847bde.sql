
-- Add scope column to transactions
ALTER TABLE public.transactions 
ADD COLUMN scope character varying NOT NULL DEFAULT 'household' 
CHECK (scope IN ('household', 'personal'));

-- Add scope column to budgets
ALTER TABLE public.budgets 
ADD COLUMN scope character varying NOT NULL DEFAULT 'household' 
CHECK (scope IN ('household', 'personal'));

-- Add scope column to savings_goals
ALTER TABLE public.savings_goals 
ADD COLUMN scope character varying NOT NULL DEFAULT 'household' 
CHECK (scope IN ('household', 'personal'));

-- Add scope column to debts
ALTER TABLE public.debts 
ADD COLUMN scope character varying NOT NULL DEFAULT 'household' 
CHECK (scope IN ('household', 'personal'));

-- Add scope column to categories (both = usable in both modes)
ALTER TABLE public.categories 
ADD COLUMN scope character varying NOT NULL DEFAULT 'both' 
CHECK (scope IN ('household', 'personal', 'both'));

-- Add created_by (user_id) to transactions for personal filtering
ALTER TABLE public.transactions 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Add created_by to budgets
ALTER TABLE public.budgets 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Add created_by to savings_goals
ALTER TABLE public.savings_goals 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Add created_by to debts
ALTER TABLE public.debts 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Backfill created_by with member_id where available for transactions
UPDATE public.transactions SET created_by = member_id WHERE member_id IS NOT NULL;

-- Update RLS for transactions: personal scope only visible by creator
DROP POLICY IF EXISTS "Users can manage household transactions" ON public.transactions;
CREATE POLICY "Users can manage transactions" ON public.transactions
FOR ALL USING (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
) WITH CHECK (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
);

-- Update RLS for budgets
DROP POLICY IF EXISTS "Users can manage household budgets" ON public.budgets;
CREATE POLICY "Users can manage budgets" ON public.budgets
FOR ALL USING (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
) WITH CHECK (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
);

-- Update RLS for savings_goals
DROP POLICY IF EXISTS "Users can manage household savings goals" ON public.savings_goals;
CREATE POLICY "Users can manage savings goals" ON public.savings_goals
FOR ALL USING (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
) WITH CHECK (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
);

-- Update RLS for debts
DROP POLICY IF EXISTS "Users can manage household debts" ON public.debts;
CREATE POLICY "Users can manage debts" ON public.debts
FOR ALL USING (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
) WITH CHECK (
  CASE 
    WHEN scope = 'personal' THEN created_by = auth.uid()
    ELSE is_household_member(auth.uid(), household_id)
  END
);
