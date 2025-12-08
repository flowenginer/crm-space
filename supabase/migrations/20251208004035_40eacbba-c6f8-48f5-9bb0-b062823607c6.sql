-- Create function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role IN ('admin', 'supervisor')
  )
$$;

-- Drop existing admin-only policies that we'll replace
DROP POLICY IF EXISTS "Admins can manage all conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can view unassigned no department conversations" ON conversations;

-- Create new policies that include supervisors
CREATE POLICY "Admins and supervisors can view all conversations" 
ON conversations FOR SELECT 
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins and supervisors can manage all conversations" 
ON conversations FOR ALL 
USING (is_admin_or_supervisor(auth.uid()));