-- ========================================
-- SISTEMA DE SINCRONIZAÇÃO DE TENANTS
-- ========================================

-- 1. Função para obter o tenant BASE (primeiro tenant ou mais antigo)
CREATE OR REPLACE FUNCTION public.get_base_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM tenants 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1
$$;

-- 2. Função para obter diferenças de menu entre dois tenants
CREATE OR REPLACE FUNCTION public.get_menu_diff(
  p_source_tenant_id UUID,
  p_target_tenant_id UUID
)
RETURNS TABLE(
  source_item_id UUID,
  source_title TEXT,
  source_href TEXT,
  source_icon TEXT,
  source_parent_id UUID,
  exists_in_target BOOLEAN,
  target_item_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    s.id as source_item_id,
    s.title::TEXT as source_title,
    s.href::TEXT as source_href,
    s.icon::TEXT as source_icon,
    s.parent_id as source_parent_id,
    CASE WHEN t.id IS NOT NULL THEN true ELSE false END as exists_in_target,
    t.id as target_item_id
  FROM menu_items s
  LEFT JOIN menu_items t ON (
    t.tenant_id = p_target_tenant_id
    AND t.title = s.title
    AND COALESCE(t.href, '') = COALESCE(s.href, '')
  )
  WHERE s.tenant_id = p_source_tenant_id
    AND s.is_active = true
  ORDER BY s.parent_id NULLS FIRST, s.position;
END;
$$;

-- 3. Função para obter status de sincronização de todos os tenants
CREATE OR REPLACE FUNCTION public.get_tenants_sync_status(p_base_tenant_id UUID)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  is_active BOOLEAN,
  total_menus BIGINT,
  base_menus BIGINT,
  missing_menus BIGINT,
  sync_percentage NUMERIC,
  is_base BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_menu_count BIGINT;
BEGIN
  -- Check if user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Get total menus in base tenant
  SELECT COUNT(*) INTO v_base_menu_count
  FROM menu_items
  WHERE tenant_id = p_base_tenant_id AND is_active = true;

  RETURN QUERY
  WITH tenant_menu_counts AS (
    SELECT 
      t.id as tid,
      t.name as tname,
      t.is_active as tactive,
      COALESCE(COUNT(mi.id), 0) as menu_count
    FROM tenants t
    LEFT JOIN menu_items mi ON mi.tenant_id = t.id AND mi.is_active = true
    GROUP BY t.id, t.name, t.is_active
  ),
  matching_menus AS (
    SELECT 
      t.id as tid,
      COUNT(DISTINCT tm.id) as matching_count
    FROM tenants t
    CROSS JOIN menu_items bm
    LEFT JOIN menu_items tm ON (
      tm.tenant_id = t.id
      AND tm.title = bm.title
      AND COALESCE(tm.href, '') = COALESCE(bm.href, '')
      AND tm.is_active = true
    )
    WHERE bm.tenant_id = p_base_tenant_id
      AND bm.is_active = true
    GROUP BY t.id
  )
  SELECT 
    tmc.tid as tenant_id,
    tmc.tname::TEXT as tenant_name,
    tmc.tactive as is_active,
    tmc.menu_count as total_menus,
    v_base_menu_count as base_menus,
    GREATEST(0, v_base_menu_count - COALESCE(mm.matching_count, 0)) as missing_menus,
    CASE 
      WHEN v_base_menu_count = 0 THEN 100
      ELSE ROUND((COALESCE(mm.matching_count, 0)::NUMERIC / v_base_menu_count::NUMERIC) * 100, 1)
    END as sync_percentage,
    (tmc.tid = p_base_tenant_id) as is_base
  FROM tenant_menu_counts tmc
  LEFT JOIN matching_menus mm ON mm.tid = tmc.tid
  ORDER BY 
    (tmc.tid = p_base_tenant_id) DESC,
    tmc.tname;
END;
$$;

-- 4. Função para sincronizar menu para TODOS os tenants de uma vez
CREATE OR REPLACE FUNCTION public.sync_menu_to_all_tenants(p_source_tenant_id UUID)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  items_copied INTEGER,
  items_skipped INTEGER,
  total_in_target INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_result RECORD;
BEGIN
  -- Check if user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Iterate over all tenants except the source
  FOR v_tenant IN 
    SELECT t.id, t.name 
    FROM tenants t 
    WHERE t.id != p_source_tenant_id 
      AND t.is_active = true
    ORDER BY t.name
  LOOP
    -- Call existing sync function for each tenant
    SELECT * INTO v_result 
    FROM sync_menu_items_to_tenant(v_tenant.id) AS r(items_copied INTEGER, items_skipped INTEGER, total_in_target INTEGER);
    
    tenant_id := v_tenant.id;
    tenant_name := v_tenant.name;
    items_copied := v_result.items_copied;
    items_skipped := v_result.items_skipped;
    total_in_target := v_result.total_in_target;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 5. Função para sincronizar menu para tenants selecionados
CREATE OR REPLACE FUNCTION public.sync_menu_to_selected_tenants(
  p_source_tenant_id UUID,
  p_target_tenant_ids UUID[]
)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  items_copied INTEGER,
  items_skipped INTEGER,
  total_in_target INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_result RECORD;
BEGIN
  -- Check if user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Iterate over selected tenants
  FOR v_tenant IN 
    SELECT t.id, t.name 
    FROM tenants t 
    WHERE t.id = ANY(p_target_tenant_ids)
      AND t.id != p_source_tenant_id
      AND t.is_active = true
    ORDER BY t.name
  LOOP
    -- Call existing sync function for each tenant
    SELECT * INTO v_result 
    FROM sync_menu_items_to_tenant(v_tenant.id) AS r(items_copied INTEGER, items_skipped INTEGER, total_in_target INTEGER);
    
    tenant_id := v_tenant.id;
    tenant_name := v_tenant.name;
    items_copied := v_result.items_copied;
    items_skipped := v_result.items_skipped;
    total_in_target := v_result.total_in_target;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 6. Adicionar coluna de configuração para auto-sync na tabela tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS auto_sync_from_base BOOLEAN DEFAULT true;

-- 7. Função trigger para auto-sincronizar novos tenants
CREATE OR REPLACE FUNCTION public.auto_sync_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_tenant_id UUID;
BEGIN
  -- Get base tenant ID
  SELECT get_base_tenant_id() INTO v_base_tenant_id;
  
  -- Only sync if we have a base tenant and it's not the same as the new one
  IF v_base_tenant_id IS NOT NULL AND v_base_tenant_id != NEW.id THEN
    -- Copy all menu items from base tenant to new tenant
    INSERT INTO menu_items (
      title, href, icon, parent_id, position, permission,
      roles, is_active, show_badge, tenant_id
    )
    SELECT 
      bm.title, bm.href, bm.icon, 
      -- Map parent_id: find matching parent in new tenant by title
      (
        SELECT nm.id FROM menu_items nm 
        WHERE nm.tenant_id = NEW.id 
          AND nm.title = (SELECT pm.title FROM menu_items pm WHERE pm.id = bm.parent_id)
        LIMIT 1
      ),
      bm.position, bm.permission, bm.roles, bm.is_active, bm.show_badge, NEW.id
    FROM menu_items bm
    WHERE bm.tenant_id = v_base_tenant_id
      AND bm.is_active = true
      AND bm.parent_id IS NULL; -- First, copy root items

    -- Then copy child items (second level)
    INSERT INTO menu_items (
      title, href, icon, parent_id, position, permission,
      roles, is_active, show_badge, tenant_id
    )
    SELECT 
      bm.title, bm.href, bm.icon, 
      (
        SELECT nm.id FROM menu_items nm 
        WHERE nm.tenant_id = NEW.id 
          AND nm.title = (SELECT pm.title FROM menu_items pm WHERE pm.id = bm.parent_id)
        LIMIT 1
      ),
      bm.position, bm.permission, bm.roles, bm.is_active, bm.show_badge, NEW.id
    FROM menu_items bm
    WHERE bm.tenant_id = v_base_tenant_id
      AND bm.is_active = true
      AND bm.parent_id IS NOT NULL;
      
    -- Copy tenant modules from base tenant
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
    SELECT NEW.id, tm.module_key, tm.is_enabled
    FROM tenant_modules tm
    WHERE tm.tenant_id = v_base_tenant_id
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Criar trigger para auto-sync (se não existir)
DROP TRIGGER IF EXISTS trigger_auto_sync_new_tenant ON tenants;
CREATE TRIGGER trigger_auto_sync_new_tenant
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_new_tenant();

-- 9. Função para obter configuração de auto-sync
CREATE OR REPLACE FUNCTION public.get_platform_sync_config()
RETURNS TABLE(
  base_tenant_id UUID,
  base_tenant_name TEXT,
  auto_sync_enabled BOOLEAN,
  total_tenants BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_id UUID;
BEGIN
  -- Check if user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  SELECT get_base_tenant_id() INTO v_base_id;

  RETURN QUERY
  SELECT 
    v_base_id as base_tenant_id,
    t.name::TEXT as base_tenant_name,
    true as auto_sync_enabled,  -- Could be stored in a settings table
    (SELECT COUNT(*) FROM tenants WHERE is_active = true)::BIGINT as total_tenants
  FROM tenants t
  WHERE t.id = v_base_id;
END;
$$;