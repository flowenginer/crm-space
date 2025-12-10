-- Criar policy para permitir que usuários vejam contatos das conversas que podem acessar
-- Isso corrige o problema onde conversas aparecem na lista mas contato é null

CREATE POLICY "Users can view contacts from accessible conversations"
ON contacts FOR SELECT
USING (
  -- Permite ver contatos de conversas que o usuário pode acessar
  id IN (
    SELECT c.contact_id 
    FROM conversations c
    WHERE 
      -- Conversas atribuídas ao usuário
      c.assigned_to = auth.uid()
      -- OU conversas pendentes do departamento do usuário
      OR (
        c.assigned_to IS NULL 
        AND c.department_id IN (
          SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = auth.uid()
          UNION
          SELECT p.department_id FROM profiles p WHERE p.id = auth.uid() AND p.department_id IS NOT NULL
        )
      )
  )
);