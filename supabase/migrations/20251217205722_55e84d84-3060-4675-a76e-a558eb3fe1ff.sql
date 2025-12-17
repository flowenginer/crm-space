-- Adicionar submenu "Campos Obrigatórios" dentro de "Configurações CRM"
INSERT INTO menu_items (title, href, icon, parent_id, position, is_active)
VALUES (
  'Campos Obrigatórios',
  '/crm/settings?tab=required-fields',
  'ListChecks',
  'dda56c7a-a66f-4156-8d7d-3f0cc0bb675c',
  5,
  true
);