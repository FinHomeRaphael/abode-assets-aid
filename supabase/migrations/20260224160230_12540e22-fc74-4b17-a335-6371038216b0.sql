
-- Table to store custom interest/principal overrides per payment date
CREATE TABLE public.debt_payment_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id),
  payment_date DATE NOT NULL,
  custom_interest NUMERIC NOT NULL,
  custom_principal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(debt_id, payment_date)
);

ALTER TABLE public.debt_payment_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage debt payment overrides"
ON public.debt_payment_overrides
FOR ALL
USING (is_household_member(auth.uid(), household_id))
WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE TRIGGER update_debt_payment_overrides_updated_at
BEFORE UPDATE ON public.debt_payment_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
