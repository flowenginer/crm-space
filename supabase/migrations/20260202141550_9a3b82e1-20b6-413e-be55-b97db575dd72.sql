-- Remover o default placeholder problemático da coluna tenant_id
ALTER TABLE contact_tags 
ALTER COLUMN tenant_id DROP DEFAULT;

-- Criar trigger para preencher tenant_id automaticamente usando a função existente
CREATE TRIGGER set_contact_tags_tenant_id
BEFORE INSERT OR UPDATE ON contact_tags
FOR EACH ROW
EXECUTE FUNCTION set_tenant_id_from_user();