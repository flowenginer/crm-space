-- Habilitar o módulo crm_settings_lead_statuses para todos os tenants que já possuem crm_settings_group habilitado
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT DISTINCT tm.tenant_id, 'crm_settings_lead_statuses', true
FROM tenant_modules tm
WHERE tm.module_key = 'crm_settings_group' 
  AND tm.is_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm2 
    WHERE tm2.tenant_id = tm.tenant_id 
    AND tm2.module_key = 'crm_settings_lead_statuses'
  );