-- Corrigir o tipo: definir DEFAULT NULL para que TypeScript aceite omitir o campo
-- O trigger set_tenant_id_from_user vai preencher o valor correto automaticamente
ALTER TABLE messages ALTER COLUMN tenant_id SET DEFAULT NULL;