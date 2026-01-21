-- Inserir menu item "Avaliação de Vendas" como submenu do grupo CRM
INSERT INTO menu_items (
  title, 
  href, 
  icon, 
  parent_id, 
  position, 
  is_active, 
  module_key, 
  tenant_id
) VALUES (
  'Avaliação de Vendas',
  '/sales-evaluation',
  'BarChart3',
  'f49fb05a-f125-4a93-9534-00b3cf305b44',
  5,
  true,
  'sales_evaluation',
  '00000000-0000-0000-0000-000000000001'
);

-- Habilitar módulo sales_evaluation para o tenant Space Sports
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'sales_evaluation', true)
ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;