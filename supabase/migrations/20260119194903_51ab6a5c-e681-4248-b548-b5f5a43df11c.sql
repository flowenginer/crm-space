-- Adicionar "Disparo por Lista" em todos os menus Marketing existentes
INSERT INTO menu_items (title, href, icon, parent_id, position, is_active, module_key, tenant_id)
SELECT 
  'Disparo por Lista',
  '/list-dispatch',
  'FileSpreadsheet',
  m.id,
  4,
  true,
  'list_dispatch',
  m.tenant_id
FROM menu_items m
WHERE m.title = 'Marketing' 
  AND m.href IS NULL 
  AND m.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items existing 
    WHERE existing.href = '/list-dispatch' 
    AND existing.parent_id = m.id
  );

-- Habilitar módulo list_dispatch para todos os tenants que têm o Marketing habilitado
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT DISTINCT 
  m.tenant_id,
  'list_dispatch',
  true
FROM menu_items m
WHERE m.title = 'Marketing' 
  AND m.href IS NULL 
  AND m.parent_id IS NULL
ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;