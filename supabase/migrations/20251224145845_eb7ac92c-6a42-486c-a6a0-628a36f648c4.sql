-- ============================================
-- ETAPA 1: Atualizar função copy_menu_items_recursive
-- Adicionar coluna module_key nos INSERTs
-- ============================================

CREATE OR REPLACE FUNCTION copy_menu_items_recursive(
  p_source_tenant_id UUID,
  p_target_tenant_id UUID
)
RETURNS TABLE(total_copied INT, root_count INT, max_depth INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_map JSONB := '{}';
  v_copied INT := 0;
  v_depth INT := 0;
  v_inserted INT := 1;
  v_root_count INT := 0;
  v_max_depth INT := 0;
  v_item RECORD;
  v_new_id UUID;
  v_new_parent_id UUID;
BEGIN
  -- 1. Limpar menu existente do tenant alvo
  DELETE FROM menu_items WHERE tenant_id = p_target_tenant_id;
  
  -- 2. Copiar itens raiz (parent_id IS NULL)
  FOR v_item IN 
    SELECT * FROM menu_items 
    WHERE tenant_id = p_source_tenant_id 
      AND parent_id IS NULL 
    ORDER BY position
  LOOP
    v_new_id := gen_random_uuid();
    
    INSERT INTO menu_items (
      id, tenant_id, title, href, icon, parent_id, position, 
      permission, roles, is_active, show_badge, module_key
    ) VALUES (
      v_new_id, p_target_tenant_id, v_item.title, v_item.href, 
      v_item.icon, NULL, v_item.position, v_item.permission, 
      v_item.roles, v_item.is_active, v_item.show_badge, v_item.module_key
    );
    
    -- Mapear ID antigo para novo
    v_id_map := v_id_map || jsonb_build_object(v_item.id::text, v_new_id::text);
    v_copied := v_copied + 1;
    v_root_count := v_root_count + 1;
  END LOOP;
  
  v_depth := 1;
  v_max_depth := CASE WHEN v_root_count > 0 THEN 1 ELSE 0 END;
  
  -- 3. Loop para copiar cada nível de profundidade
  WHILE v_inserted > 0 AND v_depth < 10 LOOP
    v_inserted := 0;
    v_depth := v_depth + 1;
    
    FOR v_item IN 
      SELECT * FROM menu_items 
      WHERE tenant_id = p_source_tenant_id 
        AND parent_id IS NOT NULL
        -- Só pegar itens cujo parent já foi mapeado
        AND v_id_map ? parent_id::text
        -- E que ainda não foram mapeados
        AND NOT (v_id_map ? id::text)
      ORDER BY position
    LOOP
      v_new_id := gen_random_uuid();
      v_new_parent_id := (v_id_map ->> v_item.parent_id::text)::UUID;
      
      INSERT INTO menu_items (
        id, tenant_id, title, href, icon, parent_id, position, 
        permission, roles, is_active, show_badge, module_key
      ) VALUES (
        v_new_id, p_target_tenant_id, v_item.title, v_item.href, 
        v_item.icon, v_new_parent_id, v_item.position, v_item.permission, 
        v_item.roles, v_item.is_active, v_item.show_badge, v_item.module_key
      );
      
      v_id_map := v_id_map || jsonb_build_object(v_item.id::text, v_new_id::text);
      v_copied := v_copied + 1;
      v_inserted := v_inserted + 1;
      v_max_depth := v_depth;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT v_copied, v_root_count, v_max_depth;
END;
$$;

-- ============================================
-- ETAPA 2: Corrigir tenants existentes
-- Popular module_key nos menu_items com NULL
-- ============================================

UPDATE menu_items mi
SET module_key = base.module_key
FROM menu_items base
WHERE mi.tenant_id != '00000000-0000-0000-0000-000000000001'
  AND base.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND mi.title = base.title
  AND mi.module_key IS NULL
  AND base.module_key IS NOT NULL;

-- ============================================
-- ETAPA 3: Criar função para obter todos os module_keys
-- Para uso na Edge Function
-- ============================================

CREATE OR REPLACE FUNCTION get_all_base_module_keys()
RETURNS TABLE(module_key TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT mi.module_key
  FROM menu_items mi
  WHERE mi.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND mi.module_key IS NOT NULL
  ORDER BY mi.module_key;
$$;

-- ============================================
-- ETAPA 4: Função de reparo de tenant_modules
-- Garante que todos os module_keys existam
-- ============================================

CREATE OR REPLACE FUNCTION repair_tenant_modules(p_tenant_id UUID)
RETURNS TABLE(inserted_count INT, existing_count INT, total_keys INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
  v_existing INT := 0;
  v_total INT := 0;
  v_key TEXT;
BEGIN
  -- Contar existentes
  SELECT COUNT(*) INTO v_existing
  FROM tenant_modules
  WHERE tenant_id = p_tenant_id;

  -- Inserir módulos faltantes (desabilitados por padrão)
  FOR v_key IN 
    SELECT DISTINCT mk.module_key
    FROM menu_items mk
    WHERE mk.tenant_id = '00000000-0000-0000-0000-000000000001'
      AND mk.module_key IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tenant_modules tm
        WHERE tm.tenant_id = p_tenant_id
          AND tm.module_key = mk.module_key
      )
  LOOP
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
    VALUES (p_tenant_id, v_key, false);
    v_inserted := v_inserted + 1;
  END LOOP;

  -- Total final
  SELECT COUNT(*) INTO v_total
  FROM tenant_modules
  WHERE tenant_id = p_tenant_id;

  RETURN QUERY SELECT v_inserted, v_existing, v_total;
END;
$$;