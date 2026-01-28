-- Enable searching profiles by email
-- We need a policy that allows authenticated users to read basic profile info of others.

-- Drop existing restricted policy if it exists (often defaults to "Users can see own profile")
-- We'll add a permissive "Read Public Profile" policy.

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can see all profiles" ON profiles;

CREATE POLICY "Authenticated users can see all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Ensure email is unique in profiles for faster lookup (optional but good)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
-- (Can't easily run DDL that might fail on duplicates without cleanup, skipping index for now)

-- Grant permissions just in case
GRANT SELECT ON profiles TO authenticated;
