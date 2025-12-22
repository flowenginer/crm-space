-- Atualizar posições dos itens existentes no CRM para abrir espaço na posição 5
UPDATE menu_items 
SET position = position + 1 
WHERE parent_id = 'f49fb05a-f125-4a93-9534-00b3cf305b44' 
AND position >= 5;

-- Inserir o novo item "Disparo em Massa" na posição 5
INSERT INTO menu_items (title, href, icon, parent_id, position, permission, is_active)
VALUES (
  'Disparo em Massa',
  '/bulk-dispatch',
  'Send',
  'f49fb05a-f125-4a93-9534-00b3cf305b44',
  5,
  'templates.view',
  true
);