
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS vehicle_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS vehicle_price DECIMAL;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS down_payment DECIMAL;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS annual_km INTEGER;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS residual_value DECIMAL;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS excess_km_cost DECIMAL;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS services_included TEXT[];
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS current_km INTEGER;
