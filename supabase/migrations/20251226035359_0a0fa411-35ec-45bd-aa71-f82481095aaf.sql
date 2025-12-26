-- Enable settings_satisfaction module for all tenants
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT t.id, 'settings_satisfaction', true
FROM tenants t
ON CONFLICT (tenant_id, module_key) 
DO UPDATE SET is_enabled = true;