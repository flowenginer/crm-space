
-- ==========================================================
-- MIGRATION: Sincronizar todas as module_keys granulares para todos os tenants
-- Garante que cada tenant tenha todas as module_keys do menu base
-- ==========================================================

DO $$
DECLARE
  v_tenant RECORD;
  v_count INT;
BEGIN
  -- Para cada tenant ativo
  FOR v_tenant IN 
    SELECT t.id, t.name
    FROM tenants t 
    WHERE t.is_active = true
  LOOP
    -- Inserir todas as module_keys granulares que estão faltando
    -- Herda o status is_enabled da key genérica se existir, senão true
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
    SELECT 
      v_tenant.id,
      mi.module_key,
      -- Verifica se existe uma key genérica correspondente e herda seu status
      COALESCE(
        (SELECT tm.is_enabled FROM tenant_modules tm 
         WHERE tm.tenant_id = v_tenant.id 
         AND mi.module_key LIKE tm.module_key || '_%'
         LIMIT 1),
        true  -- Default: habilitado
      )
    FROM menu_items mi
    WHERE mi.tenant_id = '00000000-0000-0000-0000-000000000001'
      AND mi.module_key IS NOT NULL
      AND mi.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM tenant_modules tm2
        WHERE tm2.tenant_id = v_tenant.id 
          AND tm2.module_key = mi.module_key
      )
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE 'Tenant % (%): added % granular module keys', v_tenant.name, v_tenant.id, v_count;
    END IF;
  END LOOP;
END $$;
