
-- Add subscription fields to households
ALTER TABLE public.households
ADD COLUMN plan character varying NOT NULL DEFAULT 'free',
ADD COLUMN stripe_customer_id text,
ADD COLUMN stripe_subscription_id text,
ADD COLUMN subscription_status character varying,
ADD COLUMN subscription_end_date timestamp with time zone,
ADD COLUMN ai_advice_last_date date,
ADD COLUMN ai_advice_count_this_week integer NOT NULL DEFAULT 0;
