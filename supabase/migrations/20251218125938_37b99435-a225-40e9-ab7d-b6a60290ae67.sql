-- Fix RLS policy to allow any authenticated user to claim unassigned conversations
-- This enables Lara (Expedição) and Rafik (Pós-vendas) to auto-assign themselves
-- when they send a message to an unassigned conversation from any department

DROP POLICY IF EXISTS "Users can update conversations" ON conversations;

CREATE POLICY "Users can update conversations" ON conversations
FOR UPDATE
USING (
  -- 1. User is the owner of the conversation
  assigned_to = auth.uid()
  
  -- 2. User is admin/supervisor
  OR is_admin_or_supervisor(auth.uid())
  
  -- 3. Conversation has no owner - any authenticated user can claim it
  -- The JavaScript code will handle assigning to the user and their department
  OR (assigned_to IS NULL AND auth.uid() IS NOT NULL)
  
  -- 4. User belongs to the same department as the conversation (for department-level access)
  OR department_id IN (
    SELECT department_id FROM user_departments WHERE user_id = auth.uid()
    UNION
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )
);

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update conversations" ON conversations IS 
'Allows users to update conversations they own, admins/supervisors to update any, 
any authenticated user to claim unassigned conversations, and department members to update department conversations.';