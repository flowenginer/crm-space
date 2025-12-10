-- Política para permitir que usuários vejam conversas sem atribuição do seu departamento
CREATE POLICY "Users can view unassigned conversations in their department"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  assigned_to IS NULL
  AND (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    OR
    department_id IN (
      SELECT department_id FROM user_departments WHERE user_id = auth.uid()
    )
  )
);

-- Política para usuários com acesso especial (can_view_all_conversations)
CREATE POLICY "Users with special access can view all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  public.can_view_all_data(auth.uid())
);