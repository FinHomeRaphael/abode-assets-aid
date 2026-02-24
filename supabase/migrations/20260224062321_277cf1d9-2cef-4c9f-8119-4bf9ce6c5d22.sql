-- Add individual plan column to profiles
ALTER TABLE public.profiles ADD COLUMN plan character varying NOT NULL DEFAULT 'free';

-- Reset household plan since premium will now be per-user for solo
UPDATE public.households SET plan = 'free', subscription_status = NULL;

-- Set raphael@mybat.ch as premium solo
UPDATE public.profiles SET plan = 'premium' WHERE email = 'raphael@mybat.ch';
