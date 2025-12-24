-- Reparar menus de tenants que estão com estrutura flat
-- Primeiro identificar os tenants problemáticos e depois corrigir

DO $$
DECLARE
  v_tenant RECORD;
  v_result RECORD;
BEGIN
  -- Iterar sobre todos os tenants que não são o base
  FOR v_tenant IN 
    SELECT t.id, t.name
    FROM tenants t
    WHERE t.id != '00000000-0000-0000-0000-000000000001'
      AND t.is_active = true
  LOOP
    -- Verificar saúde do menu
    SELECT * INTO v_result FROM check_tenant_menu_health(v_tenant.id);
    
    -- Se não está saudável, reparar
    IF v_result.is_healthy = false OR v_result.root_items > 20 OR v_result.max_depth < 2 THEN
      RAISE NOTICE 'Repairing menu for tenant: % (%) - roots: %, depth: %, orphans: %', 
        v_tenant.name, v_tenant.id, v_result.root_items, v_result.max_depth, v_result.orphan_items;
      
      -- Executar reparo
      PERFORM repair_tenant_menu(v_tenant.id);
      
      -- Verificar resultado
      SELECT * INTO v_result FROM check_tenant_menu_health(v_tenant.id);
      RAISE NOTICE 'After repair: roots: %, depth: %, healthy: %', 
        v_result.root_items, v_result.max_depth, v_result.is_healthy;
    ELSE
      RAISE NOTICE 'Tenant % (%) menu is healthy - skipping', v_tenant.name, v_tenant.id;
    END IF;
  END LOOP;
END $$;