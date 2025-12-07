-- Remover a política problemática que permite qualquer usuário ver conversas não atribuídas sem departamento
DROP POLICY IF EXISTS "Users can view unassigned no department conversations" ON conversations;

-- Criar nova política que só permite ADMINS verem conversas não atribuídas sem departamento
CREATE POLICY "Admins can view unassigned no department conversations"
ON conversations
FOR SELECT
USING (
  is_admin(auth.uid()) 
  AND assigned_to IS NULL 
  AND department_id IS NULL
);