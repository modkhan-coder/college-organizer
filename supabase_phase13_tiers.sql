-- Add plan column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' 
CHECK (plan IN ('free', 'pro', 'premium'));

-- Add index for potential analytics on plans
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- Grant permissions verification
GRANT SELECT, UPDATE ON profiles TO authenticated;
