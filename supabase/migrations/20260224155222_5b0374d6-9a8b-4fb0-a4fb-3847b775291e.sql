ALTER TABLE public.debts ADD COLUMN amortization_type character varying NOT NULL DEFAULT 'fixed_annuity';
-- 'fixed_annuity' = échéance fixe (annuité constante)
-- 'fixed_capital' = amortissement fixe (capital constant)