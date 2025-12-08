-- Add policy for viewing completely unassigned conversations (no assigned_to AND no department_id)
CREATE POLICY "Users can view unassigned conversations" 
ON public.conversations 
FOR SELECT 
USING (
  (assigned_to IS NULL AND department_id IS NULL AND auth.uid() IS NOT NULL)
);