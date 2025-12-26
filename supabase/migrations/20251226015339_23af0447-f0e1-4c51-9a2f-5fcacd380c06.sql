-- Fase 2: Renomear "Integrações" para "Conexões de API"
UPDATE menu_items 
SET title = 'Conexões de API'
WHERE module_key = 'settings_integrations';