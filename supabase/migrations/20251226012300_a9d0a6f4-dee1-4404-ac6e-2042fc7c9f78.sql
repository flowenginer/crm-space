-- Update menu items to point to the new /shipping route
UPDATE menu_items
SET href = '/shipping', module_key = 'crm_shipping'
WHERE href = '/crm?tab=frete';