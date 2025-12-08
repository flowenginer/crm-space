-- Drop existing policy
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- Create policy with explicit WITH CHECK (true)
-- The USING clause validates WHO can update (current row must match conditions)
-- WITH CHECK (true) allows the new data to have ANY valid assigned_to value
CREATE POLICY "Users can update conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  -- User owns the conversation
  assigned_to = auth.uid()
  OR
  -- User is admin or supervisor
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
WITH CHECK (true);