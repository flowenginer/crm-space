-- Função para sincronizar menu_items do tenant base para um tenant alvo
-- Copia apenas itens que ainda não existem no tenant alvo (merge seguro)

CREATE OR REPLACE FUNCTION public.sync_menu_items_to_tenant(
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
  -- Verificar se usuário é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- FASE 1: Mapear e copiar itens raiz (parent_id IS NULL)
  FOR v_source_item IN 
    SELECT * FROM menu_items 
    WHERE tenant_id = p_source_tenant_id 
      AND parent_id IS NULL
      AND is_active = true
    ORDER BY position
  LOOP
    -- Verificar se já existe no target (por título)
    SELECT id INTO v_existing_id
    FROM menu_items 
    WHERE tenant_id = p_target_tenant_id 
      AND parent_id IS NULL 
      AND title = v_source_item.title;
    
    IF v_existing_id IS NOT NULL THEN
      -- Já existe - mapear para usar nos filhos
      v_parent_mapping := v_parent_mapping || jsonb_build_object(v_source_item.id::text, v_existing_id);
      v_skipped := v_skipped + 1;
    ELSE
      -- Não existe - criar
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
    END IF;
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
      -- Verificar se já existe no target (por título + parent)
      SELECT id INTO v_existing_id
      FROM menu_items 
      WHERE tenant_id = p_target_tenant_id 
        AND title = v_source_item.title
        AND parent_id = (v_parent_mapping->>v_source_item.parent_id::text)::uuid;
      
      IF v_existing_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
      ELSE
        -- Não existe - criar
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
    END IF;
  END LOOP;

  -- Contar total no target
  SELECT COUNT(*) INTO v_total 
  FROM menu_items 
  WHERE tenant_id = p_target_tenant_id;

  RETURN QUERY SELECT v_copied, v_skipped, v_total;
END;
$$;

-- Função para obter menu do tenant base (para super admin usar no modal de edição)
CREATE OR REPLACE FUNCTION public.get_base_menu_items(
  p_base_tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
)
RETURNS SETOF menu_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  RETURN QUERY
  SELECT * FROM menu_items 
  WHERE tenant_id = p_base_tenant_id 
    AND is_active = true
  ORDER BY position;
END;
$$;