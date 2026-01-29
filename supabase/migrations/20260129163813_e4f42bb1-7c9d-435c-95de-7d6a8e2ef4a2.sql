-- Fix vendedor role permissions for Escola Master tenant
UPDATE role_definitions
SET permissions = jsonb_set(
  permissions,
  '{conversations}',
  '{"view": true, "create": true, "close": true, "transfer": true, "respond": true, "requests": false, "view_all": false, "view_unassigned": false}'::jsonb
)
WHERE role_key = 'vendedor' 
AND tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';