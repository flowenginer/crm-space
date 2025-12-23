
-- FASE 2 & 3: Corrigir get_date_filter_counts e copiar menu_items

-- FASE 2: Atualizar get_date_filter_counts para filtrar por tenant_id
CREATE OR REPLACE FUNCTION public.get_date_filter_counts(
  p_timezone text DEFAULT 'America/Sao_Paulo'::text, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  now_tz TIMESTAMPTZ;
  today_start TIMESTAMPTZ;
  yesterday_start TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  last_week_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  last_month_start TIMESTAMPTZ;
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  today_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
  yesterday_start := today_start - INTERVAL '1 day';
  week_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
  last_week_start := week_start - INTERVAL '1 week';
  month_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
  last_month_start := month_start - INTERVAL '1 month';

  SELECT jsonb_build_object(
    'today', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= today_start 
        AND c.created_at < today_start + INTERVAL '1 day' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'yesterday', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= yesterday_start 
        AND c.created_at < today_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'this_week', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= week_start 
        AND c.created_at < week_start + INTERVAL '1 week' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'last_week', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= last_week_start 
        AND c.created_at < week_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'this_month', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= month_start 
        AND c.created_at < month_start + INTERVAL '1 month' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'last_month', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_tenant_id
        AND c.status IN ('open', 'pending')
        AND c.created_at >= last_month_start 
        AND c.created_at < month_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- FASE 3: Criar função para copiar menu_items de um tenant para outro
CREATE OR REPLACE FUNCTION public.copy_menu_items_to_tenant(
  p_source_tenant_id UUID,
  p_target_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_parent_mapping JSONB := '{}';
  v_source_parent RECORD;
  v_target_parent RECORD;
  v_sub_item RECORD;
  v_new_id UUID;
BEGIN
  -- Primeiro, mapear os parent_ids do source para o target
  FOR v_source_parent IN 
    SELECT id, title 
    FROM menu_items 
    WHERE tenant_id = p_source_tenant_id AND parent_id IS NULL
  LOOP
    SELECT id INTO v_target_parent
    FROM menu_items 
    WHERE tenant_id = p_target_tenant_id 
      AND parent_id IS NULL 
      AND title = v_source_parent.title;
    
    IF v_target_parent IS NOT NULL THEN
      v_parent_mapping := v_parent_mapping || jsonb_build_object(v_source_parent.id::text, v_target_parent.id);
    END IF;
  END LOOP;

  -- Copiar sub-items que ainda não existem no target
  FOR v_sub_item IN
    SELECT * FROM menu_items 
    WHERE tenant_id = p_source_tenant_id 
      AND parent_id IS NOT NULL
  LOOP
    -- Verificar se já existe no target
    IF NOT EXISTS (
      SELECT 1 FROM menu_items 
      WHERE tenant_id = p_target_tenant_id 
        AND title = v_sub_item.title
        AND parent_id = (v_parent_mapping->>v_sub_item.parent_id::text)::uuid
    ) AND v_parent_mapping ? v_sub_item.parent_id::text THEN
      -- Inserir o sub-item no target
      INSERT INTO menu_items (
        title, href, icon, parent_id, position, permission, 
        roles, is_active, show_badge, tenant_id
      ) VALUES (
        v_sub_item.title,
        v_sub_item.href,
        v_sub_item.icon,
        (v_parent_mapping->>v_sub_item.parent_id::text)::uuid,
        v_sub_item.position,
        v_sub_item.permission,
        v_sub_item.roles,
        v_sub_item.is_active,
        v_sub_item.show_badge,
        p_target_tenant_id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Copiar menu_items do tenant master (SPACE SPORTS) para Space Tech
DO $$
DECLARE
  v_master_tenant_id UUID;
  v_space_tech_tenant_id UUID;
  v_copied INTEGER;
BEGIN
  -- Obter IDs dos tenants
  SELECT id INTO v_master_tenant_id FROM tenants WHERE name = 'SPACE SPORTS';
  SELECT id INTO v_space_tech_tenant_id FROM tenants WHERE name = 'SPACE TECH';
  
  IF v_master_tenant_id IS NOT NULL AND v_space_tech_tenant_id IS NOT NULL THEN
    SELECT copy_menu_items_to_tenant(v_master_tenant_id, v_space_tech_tenant_id) INTO v_copied;
    RAISE NOTICE 'Copiados % menu_items para Space Tech', v_copied;
  END IF;
END $$;

-- Também copiar para TOP CREATIVE se existir
DO $$
DECLARE
  v_master_tenant_id UUID;
  v_top_creative_tenant_id UUID;
  v_copied INTEGER;
BEGIN
  SELECT id INTO v_master_tenant_id FROM tenants WHERE name = 'SPACE SPORTS';
  SELECT id INTO v_top_creative_tenant_id FROM tenants WHERE name = 'TOP CREATIVE';
  
  IF v_master_tenant_id IS NOT NULL AND v_top_creative_tenant_id IS NOT NULL THEN
    SELECT copy_menu_items_to_tenant(v_master_tenant_id, v_top_creative_tenant_id) INTO v_copied;
    RAISE NOTICE 'Copiados % menu_items para TOP CREATIVE', v_copied;
  END IF;
END $$;
