-- Adicionar submenu "Campanhas" dentro de Marketing para cada tenant
-- e mover os itens Follow-up e Marketing para dentro dele

-- 1. Inserir submenu "Campanhas" dentro de Marketing para todos os tenants
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, is_active)
SELECT 
  mi.tenant_id,
  'Campanhas',
  NULL,
  'Target',
  mi.id,  -- parent = Marketing
  0,      -- posição antes de outros itens
  true
FROM menu_items mi
WHERE mi.title = 'Marketing' 
  AND mi.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items sub 
    WHERE sub.parent_id = mi.id 
    AND sub.title = 'Campanhas'
  );

-- 2. Inserir "Follow-up" dentro do submenu "Campanhas"
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, is_active)
SELECT 
  campanhas.tenant_id,
  'Follow-up',
  '/rescue-templates',
  'UserRoundPlus',
  campanhas.id,  -- parent = Campanhas
  0,
  true
FROM menu_items campanhas
INNER JOIN menu_items marketing ON campanhas.parent_id = marketing.id
WHERE campanhas.title = 'Campanhas'
  AND marketing.title = 'Marketing'
  AND marketing.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items sub 
    WHERE sub.parent_id = campanhas.id 
    AND sub.title = 'Follow-up'
  );

-- 3. Inserir "Marketing" dentro do submenu "Campanhas"
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, is_active)
SELECT 
  campanhas.tenant_id,
  'Marketing',
  '/marketing-campaigns',
  'Megaphone',
  campanhas.id,  -- parent = Campanhas
  1,
  true
FROM menu_items campanhas
INNER JOIN menu_items marketing ON campanhas.parent_id = marketing.id
WHERE campanhas.title = 'Campanhas'
  AND marketing.title = 'Marketing'
  AND marketing.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items sub 
    WHERE sub.parent_id = campanhas.id 
    AND sub.title = 'Marketing'
  );

-- 4. Atualizar posições dos itens existentes (Dashboard, Disparo em Massa) para virem depois de Campanhas
UPDATE menu_items
SET position = position + 1
WHERE parent_id IN (
  SELECT id FROM menu_items WHERE title = 'Marketing' AND parent_id IS NULL
)
AND title IN ('Dashboard', 'Disparo em Massa');
