
-- Create debts table
CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id),
  type varchar NOT NULL CHECK (type IN ('mortgage', 'auto', 'consumer', 'student', 'other')),
  name varchar NOT NULL,
  lender varchar,
  initial_amount numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  currency varchar NOT NULL DEFAULT 'EUR',
  interest_rate numeric NOT NULL DEFAULT 0,
  duration_years numeric NOT NULL,
  start_date date NOT NULL,
  payment_frequency varchar NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly', 'semi-annual', 'annual')),
  payment_day integer NOT NULL DEFAULT 1 CHECK (payment_day >= 1 AND payment_day <= 28),
  payment_amount numeric NOT NULL,
  category_id varchar,
  next_payment_date date,
  last_payment_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage household debts"
ON public.debts FOR ALL
USING (is_household_member(auth.uid(), household_id))
WITH CHECK (is_household_member(auth.uid(), household_id));

-- Updated at trigger
CREATE TRIGGER update_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add debt-related columns to transactions
ALTER TABLE public.transactions
ADD COLUMN is_auto_generated boolean DEFAULT false,
ADD COLUMN debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL,
ADD COLUMN debt_payment_type varchar CHECK (debt_payment_type IN ('interest', 'principal'));
