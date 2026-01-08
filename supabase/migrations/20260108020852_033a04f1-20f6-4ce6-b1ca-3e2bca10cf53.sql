-- Adicionar submenu "Status de Lead" dentro de "Configurações CRM"
-- parent_id = dda56c7a-a66f-4156-8d7d-3f0cc0bb675c (Configurações CRM)
INSERT INTO menu_items (
  id,
  tenant_id,
  title,
  href,
  icon,
  parent_id,
  position,
  permission,
  is_active,
  module_key
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Status de Lead',
  '/crm/settings?tab=lead-statuses',
  'CircleDot',
  'dda56c7a-a66f-4156-8d7d-3f0cc0bb675c',
  6,
  'settings.view',
  true,
  'crm_settings_lead_statuses'
);