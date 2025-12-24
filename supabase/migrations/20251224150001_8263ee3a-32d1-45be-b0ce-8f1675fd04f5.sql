-- Corrigir module_key para ERP e Gamificação (grupos cascata)
UPDATE menu_items 
SET module_key = 'erp_settings_group'
WHERE title = 'ERP' AND href IS NULL AND module_key IS NULL;

UPDATE menu_items 
SET module_key = 'gamification'
WHERE title = 'Gamificação' AND href IS NULL AND module_key IS NULL;