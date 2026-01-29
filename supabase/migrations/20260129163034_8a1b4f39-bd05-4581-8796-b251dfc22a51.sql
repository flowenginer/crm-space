-- Remover DEFAULT hardcoded da coluna tenant_id em tabelas críticas
-- Isso permite que o trigger set_tenant_id_from_user funcione corretamente

ALTER TABLE conversations 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE contacts 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE messages 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE whatsapp_channels 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE departments 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE tags 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE message_templates 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE deals 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE call_logs 
ALTER COLUMN tenant_id DROP DEFAULT;