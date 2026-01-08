-- Desabilitar módulo super_admin para todos os tenants exceto o base (00000000-0000-0000-0000-000000000001)
UPDATE tenant_modules
SET is_enabled = false
WHERE module_key = 'super_admin'
  AND tenant_id != '00000000-0000-0000-0000-000000000001';