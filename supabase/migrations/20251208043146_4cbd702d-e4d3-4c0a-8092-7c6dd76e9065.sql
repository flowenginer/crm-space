-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- Create a more comprehensive UPDATE policy that allows:
-- 1. Users to update their own conversations
-- 2. Users to update unassigned conversations in their department
-- 3. Admins/supervisors to update any conversation
CREATE POLICY "Users can update conversations"
ON public.conversations
FOR UPDATE
USING (
  assigned_to = auth.uid()
  OR (assigned_to IS NULL AND department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  ))
  OR is_admin_or_supervisor(auth.uid())
)
WITH CHECK (
  -- Allow setting assigned_to to null (for department transfers)
  -- or to any user (for user transfers)
  -- as long as the user had permission to update based on USING clause
  true
);