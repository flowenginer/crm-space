-- Adicionar permissão ao item de menu "Canais" para controlar visibilidade
UPDATE menu_items 
SET permission = 'settings.channels' 
WHERE id = '02979fb3-d17a-4d6d-ac5a-c41994e6f388';