-- Habilitar transferência livre para todos os departamentos da Master
UPDATE departments 
SET can_transfer_freely = true 
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';

COMMENT ON TABLE departments 
IS 'can_transfer_freely=true permite que membros transfiram qualquer conversa, não apenas as atribuídas a eles';