-- Drop the problematic CHECK constraint and replace with a trigger-based validation
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_payment_day_check;

-- Notify PostgREST to reload schema (picks up account_id column)
NOTIFY pgrst, 'reload schema';