-- Criar policy para permitir que usuários atualizem contatos das conversas que podem acessar
-- Isso corrige o problema onde vendedores não conseguem alterar status de lead ou editar contato

CREATE POLICY "Users can update contacts from accessible conversations"
ON contacts FOR UPDATE
USING (
  -- Permite atualizar contatos de conversas que o usuário pode acessar
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