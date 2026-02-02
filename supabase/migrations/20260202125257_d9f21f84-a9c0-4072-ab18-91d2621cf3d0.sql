-- Correção 1: Habilitar visualização global nos departamentos Master
UPDATE departments
SET can_view_all_conversations = true
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';

-- Correção 2: Adicionar política RLS para leitura tenant-wide de contatos
-- Esta política permite que todos os usuários autenticados do mesmo tenant
-- visualizem todos os contatos, mantendo restrições de UPDATE
CREATE POLICY "Users can view all tenant contacts"
  ON contacts FOR SELECT
  USING (tenant_id = get_user_tenant_id());