-- Add stripe_subscription_id column to profiles table
-- This allows us to track the specific subscription ID for a user, 
-- enabling better cleanup and verification logic.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id);
