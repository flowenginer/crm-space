-- Excluir itens duplicados de Orçamento
DELETE FROM menu_items 
WHERE id IN (
  '167fa5e8-910e-4a19-ac77-6c16a3e1d6c6',
  '726ec211-15b2-4377-92ca-4dccfee4b8e9'
);

-- Criar item correto dentro do menu ERP
INSERT INTO menu_items (title, href, icon, parent_id, position, permission, is_active)
VALUES (
  'Orçamentos',
  '/quotes',
  'FileText',
  '5cd3c308-97ae-4c07-bce1-1a41c338d03b',
  4,
  'deals.view',
  true
);