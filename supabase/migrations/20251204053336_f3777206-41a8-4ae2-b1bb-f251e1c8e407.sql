-- Drop the recursive policies that cause issues
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Keep the simple authenticated policy which should work
-- The "Authenticated can view profiles" already exists and allows all authenticated users to read