-- Função interna para sincronizar menu_items (sem verificação de super_admin)
-- Para uso pelo service role na edge function create-tenant-admin

CREATE OR REPLACE FUNCTION public.sync_menu_items_to_tenant_internal(
  p_target_tenant_id UUID,
  p_source_tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
)
RETURNS TABLE(
  items_copied INTEGER,
  items_skipped INTEGER,
  total_in_target INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_copied INTEGER := 0;
  v_skipped INTEGER := 0;
  v_total INTEGER := 0;
  v_source_item RECORD;
  v_parent_mapping JSONB := '{}';
  v_new_id UUID;
  v_existing_id UUID;
BEGIN
  -- Primeiro, limpar menu_items existentes do tenant alvo (para evitar duplicatas)
  DELETE FROM menu_items WHERE tenant_id = p_target_tenant_id;

  -- FASE 1: Mapear e copiar itens raiz (parent_id IS NULL)
  FOR v_source_item IN 
    SELECT * FROM menu_items 
    WHERE tenant_id = p_source_tenant_id 
      AND parent_id IS NULL
      AND is_active = true
    ORDER BY position
  LOOP
    v_new_id := gen_random_uuid();
    
    INSERT INTO menu_items (
      id, title, href, icon, parent_id, position, 
      permission, roles, is_active, show_badge, tenant_id
    ) VALUES (
      v_new_id,
      v_source_item.title,
      v_source_item.href,
      v_source_item.icon,
      NULL,
      v_source_item.position,
      v_source_item.permission,
      v_source_item.roles,
      v_source_item.is_active,
      v_source_item.show_badge,
      p_target_tenant_id
    );
    
    v_parent_mapping := v_parent_mapping || jsonb_build_object(v_source_item.id::text, v_new_id);
    v_copied := v_copied + 1;
  END LOOP;

  -- FASE 2: Copiar subitens (com parent_id)
  FOR v_source_item IN 
    SELECT * FROM menu_items 
    WHERE tenant_id = p_source_tenant_id 
      AND parent_id IS NOT NULL
      AND is_active = true
    ORDER BY position
  LOOP
    -- Verificar se o parent foi mapeado
    IF v_parent_mapping ? v_source_item.parent_id::text THEN
      v_new_id := gen_random_uuid();
      
      INSERT INTO menu_items (
        id, title, href, icon, parent_id, position, 
        permission, roles, is_active, show_badge, tenant_id
      ) VALUES (
        v_new_id,
        v_source_item.title,
        v_source_item.href,
        v_source_item.icon,
        (v_parent_mapping->>v_source_item.parent_id::text)::uuid,
        v_source_item.position,
        v_source_item.permission,
        v_source_item.roles,
        v_source_item.is_active,
        v_source_item.show_badge,
        p_target_tenant_id
      );
      
      v_copied := v_copied + 1;
    END IF;
  END LOOP;

  -- Contar total no target
  SELECT COUNT(*) INTO v_total 
  FROM menu_items 
  WHERE tenant_id = p_target_tenant_id;

  RETURN QUERY SELECT v_copied, v_skipped, v_total;
END;
$$;

-- Conceder permissão para o anon e service role usarem a função
GRANT EXECUTE ON FUNCTION public.sync_menu_items_to_tenant_internal(UUID, UUID) TO anon, authenticated, service_role;