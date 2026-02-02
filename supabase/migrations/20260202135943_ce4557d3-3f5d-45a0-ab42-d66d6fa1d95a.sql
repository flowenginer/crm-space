-- Restaurar DEFAULT do tenant_id para contact_tags para funcionar com triggers
-- O trigger set_tenant_id_from_user vai sobrescrever com o valor correto

-- A tabela contact_tags precisa de um DEFAULT temporário para passar a validação de tipos
-- mas o trigger vai garantir o tenant correto
ALTER TABLE contact_tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- Adicionar constraint para garantir que INSERT funcione antes do trigger
-- O trigger set_tenant_id_from_user vai atualizar o valor correto