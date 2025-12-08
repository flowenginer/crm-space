-- Drop existing UPDATE policy for conversations
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- Create a more permissive UPDATE policy that handles:
-- 1. Users updating their own conversations (assigned_to = user)
-- 2. Users in the same department updating unassigned conversations
-- 3. ANY authenticated user can update completely unassigned conversations (no assigned_to AND no department_id)
-- 4. Admins/supervisors can update any conversation
CREATE POLICY "Users can update conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  -- User owns the conversation
  (assigned_to = auth.uid()) 
  OR 
  -- Conversation is unassigned but in user's department
  ((assigned_to IS NULL) AND (department_id IN ( 
    SELECT profiles.department_id 
    FROM profiles 
    WHERE profiles.id = auth.uid()
  )))
  OR
  -- Conversation is completely orphan (no assigned_to AND no department) - any authenticated user can claim/update it
  ((assigned_to IS NULL) AND (department_id IS NULL) AND (auth.uid() IS NOT NULL))
  OR 
  -- Admins and supervisors can update any conversation
  is_admin_or_supervisor(auth.uid())
)
WITH CHECK (true);