-- Criar função recursiva robusta para copiar menu_items com hierarquia N níveis
CREATE OR REPLACE FUNCTION copy_menu_items_recursive(
  p_source_tenant_id UUID,
  p_target_tenant_id UUID
)
RETURNS TABLE(total_copied INT, root_count INT, max_depth INT) AS $$
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
      permission, roles, is_active, show_badge
    ) VALUES (
      v_new_id, p_target_tenant_id, v_item.title, v_item.href, 
      v_item.icon, NULL, v_item.position, v_item.permission, 
      v_item.roles, v_item.is_active, v_item.show_badge
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
        permission, roles, is_active, show_badge
      ) VALUES (
        v_new_id, p_target_tenant_id, v_item.title, v_item.href, 
        v_item.icon, v_new_parent_id, v_item.position, v_item.permission, 
        v_item.roles, v_item.is_active, v_item.show_badge
      );
      
      v_id_map := v_id_map || jsonb_build_object(v_item.id::text, v_new_id::text);
      v_copied := v_copied + 1;
      v_inserted := v_inserted + 1;
      v_max_depth := v_depth;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT v_copied, v_root_count, v_max_depth;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para reparar tenants com menu flat
CREATE OR REPLACE FUNCTION repair_tenant_menu(p_tenant_id UUID)
RETURNS TABLE(total_copied INT, root_count INT, max_depth INT) AS $$
BEGIN
  RETURN QUERY SELECT * FROM copy_menu_items_recursive(
    '00000000-0000-0000-0000-000000000001'::UUID,
    p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para verificar saúde do menu de um tenant
CREATE OR REPLACE FUNCTION check_tenant_menu_health(p_tenant_id UUID)
RETURNS TABLE(
  total_items INT,
  root_items INT,
  max_depth INT,
  orphan_items INT,
  is_healthy BOOLEAN
) AS $$
DECLARE
  v_total INT;
  v_roots INT;
  v_orphans INT;
  v_max_depth INT;
BEGIN
  -- Contar total
  SELECT COUNT(*) INTO v_total FROM menu_items WHERE tenant_id = p_tenant_id;
  
  -- Contar roots
  SELECT COUNT(*) INTO v_roots FROM menu_items WHERE tenant_id = p_tenant_id AND parent_id IS NULL;
  
  -- Contar órfãos (parent_id não nulo mas parent não existe)
  SELECT COUNT(*) INTO v_orphans 
  FROM menu_items m
  WHERE m.tenant_id = p_tenant_id 
    AND m.parent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM menu_items p 
      WHERE p.id = m.parent_id AND p.tenant_id = p_tenant_id
    );
  
  -- Calcular profundidade máxima
  WITH RECURSIVE depth_calc AS (
    SELECT id, 1 as depth
    FROM menu_items
    WHERE tenant_id = p_tenant_id AND parent_id IS NULL
    
    UNION ALL
    
    SELECT m.id, dc.depth + 1
    FROM menu_items m
    JOIN depth_calc dc ON m.parent_id = dc.id
    WHERE m.tenant_id = p_tenant_id
  )
  SELECT COALESCE(MAX(depth), 0) INTO v_max_depth FROM depth_calc;
  
  RETURN QUERY SELECT 
    v_total,
    v_roots,
    v_max_depth,
    v_orphans,
    (v_roots BETWEEN 8 AND 15 AND v_orphans = 0 AND v_max_depth >= 2) AS is_healthy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;