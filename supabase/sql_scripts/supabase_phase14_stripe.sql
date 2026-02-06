-- Phase 14: Stripe Integration

-- Add Stripe columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'incomplete'
ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

-- Add index for fast lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

-- Security: Allow users to read their own subscription data (policies already exist for profiles select)
-- Ensure service_role can update these columns (default behavior)
