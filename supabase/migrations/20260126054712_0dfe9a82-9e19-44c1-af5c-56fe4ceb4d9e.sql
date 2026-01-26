-- Habilitar módulos de suporte para Space Sports
DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Inserir módulos de suporte habilitados
  INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
  VALUES 
    (v_tenant_id, 'support_group', true),
    (v_tenant_id, 'support_tickets', true),
    (v_tenant_id, 'support_dashboard', true),
    (v_tenant_id, 'support_technicians', true)
  ON CONFLICT (tenant_id, module_key) 
  DO UPDATE SET is_enabled = true;
  
  RAISE NOTICE 'Support modules enabled for Space Sports';
END $$;

-- Adicionar permissões de suporte ao role 'admin' do Space Sports
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{support}',
  '{"view": true, "manage": true, "admin": true}'::jsonb
)
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND role_name = 'admin';

-- Adicionar permissão support.view para outros roles (supervisor, vendedor, etc.)
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{support}',
  '{"view": true}'::jsonb
)
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND role_name IN ('supervisor', 'vendedor', 'designer', 'sac');