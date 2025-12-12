-- Atualizar permissão do Orçamentos para orders.view (mesmo que Pedidos)
UPDATE menu_items 
SET permission = 'orders.view'
WHERE title = 'Orçamentos' AND parent_id = '5cd3c308-97ae-4c07-bce1-1a41c338d03b';