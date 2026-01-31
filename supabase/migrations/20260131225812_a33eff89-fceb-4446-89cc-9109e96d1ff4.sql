-- Habilitar módulo crm_bulk_update para todos os tenants que têm crm_group habilitado
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT DISTINCT tm.tenant_id, 'crm_bulk_update', true
FROM tenant_modules tm
WHERE tm.module_key = 'crm_group' AND tm.is_enabled = true
ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;

-- Também habilitar para o tenant base (Space Sports) especificamente
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'crm_bulk_update', true)
ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;