-- Drop existing policy
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- Create policy with proper WITH CHECK that allows admins/supervisors
CREATE POLICY "Users can update conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  -- User owns the conversation
  assigned_to = auth.uid()
  OR
  -- User is admin or supervisor (inline check)
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
  OR
  -- Unassigned in user's department
  (
    assigned_to IS NULL 
    AND department_id IN (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  OR
  -- Orphan conversation (no assignment, no department)
  (assigned_to IS NULL AND department_id IS NULL AND auth.uid() IS NOT NULL)
)
WITH CHECK (
  -- Allow the update if user is admin/supervisor
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
  OR
  -- Or if user is assigning to themselves
  assigned_to = auth.uid()
  OR
  -- Or if conversation becomes unassigned
  assigned_to IS NULL
  OR
  -- Or if the new assigned_to is a valid user
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = assigned_to
  )
);