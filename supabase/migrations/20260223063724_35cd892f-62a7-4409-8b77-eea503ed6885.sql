
-- Add scope and created_by to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS scope character varying NOT NULL DEFAULT 'household',
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage household accounts" ON public.accounts;

-- Create new scope-aware policy
CREATE POLICY "Users can manage accounts" ON public.accounts
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
