-- Update tenant_modules to use the new module_key
UPDATE tenant_modules
SET module_key = 'crm_shipping'
WHERE module_key = 'crm_frete';