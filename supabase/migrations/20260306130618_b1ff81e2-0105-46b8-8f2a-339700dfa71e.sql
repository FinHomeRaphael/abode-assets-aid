
-- Add coach IA usage tracking fields to households
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS coach_ia_conversations_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS coach_ia_reset_date date NULL;
