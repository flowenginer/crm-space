-- Correção: RLS de Canais WhatsApp para Multi-Tenant
-- Remove DEFAULT que aponta para master tenant e atualiza política RLS

-- 1. Remover o DEFAULT do tenant_id
ALTER TABLE whatsapp_channels 
ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Atualizar política RLS para permitir NULL no WITH CHECK
DROP POLICY IF EXISTS "Tenant isolation for whatsapp_channels" ON whatsapp_channels;

CREATE POLICY "Tenant isolation for whatsapp_channels" ON whatsapp_channels
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());