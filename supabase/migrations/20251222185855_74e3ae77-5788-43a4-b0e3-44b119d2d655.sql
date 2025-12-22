-- Atualizar política de UPDATE em active_rescues para permitir que quem ativou o resgate possa cancelá-lo
DROP POLICY IF EXISTS "Users can update rescues for their conversations" ON active_rescues;

CREATE POLICY "Users can update rescues for their conversations" 
ON active_rescues
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_admin_or_supervisor(auth.uid()) 
    OR activated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = active_rescues.conversation_id 
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    )
  )
);