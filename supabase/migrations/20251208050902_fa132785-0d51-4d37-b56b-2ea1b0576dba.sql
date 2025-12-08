-- =====================================================
-- FIX: Allow users to transfer their own conversations
-- The issue: WITH CHECK (true) still requires the USING clause to match
-- for the UPDATE to succeed. We need a more permissive WITH CHECK that
-- allows the update if the user WAS the assigned_to before.
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can update conversations" ON conversations;

-- Create a new policy that allows users to update conversations they own
-- USING: checks who can access the row to update
-- WITH CHECK: checks if the new values are allowed (we set to true to allow any changes)
CREATE POLICY "Users can update conversations"
ON conversations
FOR UPDATE
USING (
  -- User is the current owner
  (assigned_to = auth.uid())
  -- OR conversation is unassigned and in user's department  
  OR ((assigned_to IS NULL) AND (department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )))
  -- OR conversation is completely orphan (no owner, no department)
  OR ((assigned_to IS NULL) AND (department_id IS NULL) AND (auth.uid() IS NOT NULL))
  -- OR user is admin/supervisor
  OR is_admin_or_supervisor(auth.uid())
)
WITH CHECK (true);