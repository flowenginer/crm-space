-- 1. Marcar UAZAPI como compartilhado globalmente
UPDATE whatsapp_providers 
SET is_shared = true 
WHERE code = 'uazapi';

-- 2. Remover policies antigas
DROP POLICY IF EXISTS "Tenant isolation for whatsapp_providers" ON whatsapp_providers;
DROP POLICY IF EXISTS "Tenants can only modify own providers" ON whatsapp_providers;
DROP POLICY IF EXISTS "Tenants can only update own providers" ON whatsapp_providers;
DROP POLICY IF EXISTS "Tenants can only delete own providers" ON whatsapp_providers;

-- 3. Criar policy de SELECT que permite provedores compartilhados
CREATE POLICY "Select own or shared providers"
ON whatsapp_providers FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id() 
  OR is_shared = true
);

-- 4. Policies de modificação apenas para provedores próprios
CREATE POLICY "Insert own providers only"
ON whatsapp_providers FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Update own providers only"
ON whatsapp_providers FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Delete own providers only"
ON whatsapp_providers FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id());