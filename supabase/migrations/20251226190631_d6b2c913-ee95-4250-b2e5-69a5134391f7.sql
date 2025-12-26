-- Remover índice antigo que impede mesmo telefone em tenants diferentes
DROP INDEX IF EXISTS contacts_phone_unique;

-- Criar novo índice que permite mesmo telefone em tenants diferentes
-- Isso é essencial para multi-tenancy: o mesmo número pode ser cliente de várias empresas
CREATE UNIQUE INDEX IF NOT EXISTS contacts_phone_tenant_unique 
  ON public.contacts (phone, tenant_id);