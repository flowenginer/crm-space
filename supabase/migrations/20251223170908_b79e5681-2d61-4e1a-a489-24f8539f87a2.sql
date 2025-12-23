
-- Primeiro, buscar os IDs dos tenants
DO $$
DECLARE
  source_tenant_id uuid;
  target_tenant_id uuid;
  source_permissions jsonb;
BEGIN
  -- Obter o ID do tenant SPACE SPORTS
  SELECT id INTO source_tenant_id FROM tenants WHERE name = 'SPACE SPORTS';
  
  -- Obter o ID do tenant SPACE TECH
  SELECT id INTO target_tenant_id FROM tenants WHERE name = 'SPACE TECH';
  
  -- Para cada role_key, copiar as permissões
  UPDATE role_definitions target
  SET permissions = source.permissions
  FROM role_definitions source
  WHERE source.tenant_id = source_tenant_id
    AND target.tenant_id = target_tenant_id
    AND source.role_key = target.role_key
    AND (target.permissions IS NULL OR target.permissions = '{}'::jsonb);
END $$;
