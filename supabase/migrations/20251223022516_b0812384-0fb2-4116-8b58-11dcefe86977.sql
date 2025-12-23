-- 1. Remover constraint errada (se existir)
ALTER TABLE role_definitions DROP CONSTRAINT IF EXISTS role_definitions_role_key_key;

-- 2. Criar constraint correta (única por tenant)
ALTER TABLE role_definitions ADD CONSTRAINT role_definitions_tenant_role_key UNIQUE (tenant_id, role_key);

-- 3. Inserir role definitions para o tenant Top Creative copiando do tenant padrão
INSERT INTO role_definitions (tenant_id, role_key, role_name, description, color, icon, permissions, order_position, is_system)
SELECT 
  '5b0b28a2-56dd-447e-b61d-36c432fc2d74'::uuid,
  role_key, role_name, description, color, icon, permissions, order_position, is_system
FROM role_definitions
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- 4. Corrigir o perfil do admin da Top Creative
UPDATE profiles 
SET role = 'admin', email = 'topcreative.envios@gmail.com'
WHERE id = '71b0306e-244a-4ff5-a4a8-161b5c68de3c';