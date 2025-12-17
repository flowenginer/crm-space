-- Remove href do menu "Configurações CRM" para transformá-lo em menu cascata
UPDATE menu_items 
SET href = NULL, updated_at = now()
WHERE id = 'dda56c7a-a66f-4156-8d7d-3f0cc0bb675c';