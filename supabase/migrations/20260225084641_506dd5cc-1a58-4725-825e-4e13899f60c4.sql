
-- Add mortgage-specific fields to debts table
ALTER TABLE public.debts 
  ADD COLUMN IF NOT EXISTS mortgage_system character varying DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rate_type character varying NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS rate_end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS property_value numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS annual_amortization numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swiss_amortization_type character varying DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS include_maintenance boolean DEFAULT false;
