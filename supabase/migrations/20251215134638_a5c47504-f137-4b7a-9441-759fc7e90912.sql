-- Adicionar item de menu "Segmentos" nas configurações
INSERT INTO menu_items (title, href, icon, parent_id, position, is_active, permission)
VALUES ('Segmentos', '/settings?tab=segments', 'Layers', '9240ef7d-d4e5-4ae9-b260-06180d15f453', 7, true, 'settings.segments');