
-- Create debt_schedules table for storing full amortization schedules
CREATE TABLE public.debt_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id),
  due_date DATE NOT NULL,
  period_number INTEGER NOT NULL,
  capital_before NUMERIC NOT NULL,
  capital_after NUMERIC NOT NULL,
  interest_amount NUMERIC NOT NULL,
  principal_amount NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'prevu',
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique constraint: one schedule entry per debt per due_date
ALTER TABLE public.debt_schedules ADD CONSTRAINT debt_schedules_debt_date_unique UNIQUE (debt_id, due_date);

-- Enable RLS
ALTER TABLE public.debt_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policy: household members can manage schedules
CREATE POLICY "Users can manage debt schedules"
  ON public.debt_schedules
  FOR ALL
  USING (is_household_member(auth.uid(), household_id))
  WITH CHECK (is_household_member(auth.uid(), household_id));

-- Index for fast lookups
CREATE INDEX idx_debt_schedules_debt_id ON public.debt_schedules(debt_id);
CREATE INDEX idx_debt_schedules_due_date ON public.debt_schedules(due_date);

-- Trigger for updated_at
CREATE TRIGGER update_debt_schedules_updated_at
  BEFORE UPDATE ON public.debt_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
