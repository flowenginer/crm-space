-- Drop existing UPDATE policies on conversations that might conflict
DROP POLICY IF EXISTS "Users can update assigned conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update department unassigned conversations" ON public.conversations;

-- Create a unified UPDATE policy that allows:
-- 1. Users to update their own conversations (including transfer)
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
);

-- Update the conversation_events policy to allow event creation
-- First check if there's an existing policy
DROP POLICY IF EXISTS "Authenticated access conversation_events" ON public.conversation_events;

-- Create a more permissive INSERT policy for conversation_events
CREATE POLICY "Users can create conversation events"
ON public.conversation_events
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- User can create events for conversations they own or that are unassigned in their dept
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        c.assigned_to = auth.uid()
        OR (c.assigned_to IS NULL AND c.department_id IN (
          SELECT department_id FROM profiles WHERE id = auth.uid()
        ))
        OR is_admin_or_supervisor(auth.uid())
      )
    )
  )
);

-- Create SELECT policy for conversation_events
CREATE POLICY "Users can view conversation events"
ON public.conversation_events
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create UPDATE policy for conversation_events (in case needed)
CREATE POLICY "Users can update conversation events"
ON public.conversation_events
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Create DELETE policy for conversation_events (admin only)
CREATE POLICY "Admins can delete conversation events"
ON public.conversation_events
FOR DELETE
USING (is_admin_or_supervisor(auth.uid()));