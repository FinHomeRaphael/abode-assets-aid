
CREATE TABLE IF NOT EXISTS public.health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  savings_rate_score INTEGER,
  debt_to_income_score INTEGER,
  emergency_fund_score INTEGER,
  budget_compliance_score INTEGER,
  debt_service_score INTEGER,
  progression_score INTEGER,
  savings_rate_percent NUMERIC,
  debt_to_income_ratio NUMERIC,
  emergency_fund_months NUMERIC,
  budgets_respected_percent NUMERIC,
  debt_service_ratio NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(household_id, month_year)
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household health scores"
  ON public.health_scores FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert own household health scores"
  ON public.health_scores FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update own household health scores"
  ON public.health_scores FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));
