-- Adicionar o menu "Status de Lead" para todos os tenants que possuem "Configurações CRM"
-- Baseado no parent que é "Configurações CRM" (module_key = 'crm_settings_group')
INSERT INTO menu_items (id, tenant_id, title, href, icon, parent_id, position, permission, is_active, module_key)
SELECT 
  gen_random_uuid(),
  parent.tenant_id,
  'Status de Lead',
  '/crm/settings?tab=lead-statuses',
  'CircleDot',
  parent.id,
  6,
  'settings.view',
  true,
  'crm_settings_lead_statuses'
FROM menu_items parent
WHERE parent.module_key = 'crm_settings_group'
  AND parent.tenant_id != '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM menu_items m2 
    WHERE m2.tenant_id = parent.tenant_id 
    AND m2.module_key = 'crm_settings_lead_statuses'
  );