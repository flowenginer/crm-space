-- Corrigir parent_id do item "Ligações" para ficar dentro de "Relatórios"
UPDATE menu_items 
SET parent_id = '35a0c87e-7185-47e7-8e1d-930687d72685', 
    position = 8
WHERE id = '19d50336-3b67-41fe-923a-35f36e084245';