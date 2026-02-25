
-- Drop existing foreign keys and recreate with ON DELETE CASCADE

-- debt_schedules -> debts
ALTER TABLE public.debt_schedules DROP CONSTRAINT IF EXISTS debt_schedules_debt_id_fkey;
ALTER TABLE public.debt_schedules ADD CONSTRAINT debt_schedules_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES public.debts(id) ON DELETE CASCADE;

-- debt_payment_overrides -> debts
ALTER TABLE public.debt_payment_overrides DROP CONSTRAINT IF EXISTS debt_payment_overrides_debt_id_fkey;
ALTER TABLE public.debt_payment_overrides ADD CONSTRAINT debt_payment_overrides_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES public.debts(id) ON DELETE CASCADE;

-- transactions -> debts (SET NULL so transactions aren't lost, just unlinked)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_debt_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES public.debts(id) ON DELETE SET NULL;
