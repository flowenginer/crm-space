-- Drop existing policy
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- Create policy with simple WITH CHECK = true
-- The USING clause already validates WHO can update, 
-- WITH CHECK = true allows any valid update data
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
  -- Orphan conversation
  (assigned_to IS NULL AND department_id IS NULL AND auth.uid() IS NOT NULL)
);