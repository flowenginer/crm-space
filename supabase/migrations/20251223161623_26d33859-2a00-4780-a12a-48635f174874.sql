-- =====================================================
-- CRITICAL FIX: Add tenant_id filtering to all SECURITY DEFINER RPCs
-- This ensures complete multi-tenant isolation
-- =====================================================

-- 1. FIX search_contacts_paginated
CREATE OR REPLACE FUNCTION public.search_contacts_paginated(
  p_search_query text DEFAULT NULL::text, 
  p_state_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_assigned_to uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_offset integer DEFAULT 0, 
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  phone text, 
  email text, 
  avatar_url text, 
  state text, 
  city text, 
  lead_status text, 
  first_contact_at timestamp with time zone, 
  last_interaction_at timestamp with time zone, 
  assigned_to uuid, 
  department_id uuid, 
  is_online boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  notes text, 
  cpf_cnpj text, 
  birth_date date, 
  street text, 
  number text, 
  complement text, 
  neighborhood text, 
  zip_code text, 
  country text, 
  person_type text, 
  origin text, 
  custom_fields jsonb, 
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  -- Contar total COM TENANT FILTER
  SELECT COUNT(*) INTO v_total
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retornar resultados paginados COM TENANT FILTER
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.state,
    c.city,
    c.lead_status,
    c.first_contact_at,
    c.last_interaction_at,
    c.assigned_to,
    c.department_id,
    c.is_online,
    c.created_at,
    c.updated_at,
    c.notes,
    c.cpf_cnpj,
    c.birth_date,
    c.street,
    c.number,
    c.complement,
    c.neighborhood,
    c.zip_code,
    c.country,
    c.person_type,
    c.origin,
    c.custom_fields,
    v_total as total_count
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ORDER BY c.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$function$;

-- 2. FIX get_contacts_by_tag_filter
CREATE OR REPLACE FUNCTION public.get_contacts_by_tag_filter(
  p_tag_ids uuid[], 
  p_search_query text DEFAULT NULL::text, 
  p_state_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_assigned_to uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_offset integer DEFAULT 0, 
  p_limit integer DEFAULT 50
)
RETURNS TABLE(contact_id uuid, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  -- Primeiro conta o total COM TENANT FILTER
  SELECT COUNT(DISTINCT c.id) INTO v_total
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE c.tenant_id = v_user_tenant
    AND ct.tenant_id = v_user_tenant
    AND ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retorna os IDs paginados com o total COM TENANT FILTER
  RETURN QUERY
  SELECT DISTINCT c.id as contact_id, v_total as total_count
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE c.tenant_id = v_user_tenant
    AND ct.tenant_id = v_user_tenant
    AND ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ORDER BY c.id
  OFFSET p_offset
  LIMIT p_limit;
END;
$function$;

-- 3. FIX search_contacts_unaccent (both overloads)
DROP FUNCTION IF EXISTS public.search_contacts_unaccent(text);
DROP FUNCTION IF EXISTS public.search_contacts_unaccent(text, integer);

CREATE OR REPLACE FUNCTION public.search_contacts_unaccent(p_search_term text)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (unaccent(lower(c.full_name)) ILIKE '%' || unaccent(lower(p_search_term)) || '%'
     OR unaccent(lower(c.phone)) ILIKE '%' || unaccent(lower(p_search_term)) || '%')
  LIMIT 100;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_contacts_unaccent(p_search_query text, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, full_name text, phone text, email text, avatar_url text, assigned_to uuid, lead_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.assigned_to,
    c.lead_status
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%'
    OR c.phone ILIKE '%' || p_search_query || '%'
    OR c.email ILIKE '%' || p_search_query || '%')
  ORDER BY c.full_name
  LIMIT p_limit;
END;
$function$;

-- 4. FIX get_dashboard_metrics_aggregated
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_aggregated(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conversion_names TEXT[];
  v_metrics JSONB;
  v_origin_data JSONB;
  v_status_funnel JSONB;
  v_alerts JSONB;
  v_total_conversations BIGINT;
  v_total_assigned BIGINT;
  v_total_responded BIGINT;
  v_avg_response_time INTEGER;
  v_avg_assignment_time INTEGER;
  v_conversions BIGINT;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN jsonb_build_object('metrics', '{}', 'origin_data', '[]', 'status_funnel', '[]', 'alerts', '[]');
  END IF;

  -- Obter nomes dos status de conversão
  v_conversion_names := get_conversion_status_names();

  -- =====================================================
  -- MÉTRICAS PRINCIPAIS - COM TENANT FILTER
  -- =====================================================
  SELECT COUNT(*) INTO v_total_conversations
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COUNT(*) INTO v_total_assigned
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COUNT(*) INTO v_total_responded
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)))::INTEGER, 0)
  INTO v_avg_response_time
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COALESCE(AVG(lah.time_to_assign_seconds)::INTEGER, 0)
  INTO v_avg_assignment_time
  FROM lead_assignment_history lah
  WHERE lah.tenant_id = v_user_tenant
    AND lah.assigned_at >= p_date_from
    AND lah.assigned_at <= p_date_to
    AND lah.assignment_type = 'first_assignment'
    AND (p_agent_id IS NULL OR lah.assigned_to = p_agent_id);

  SELECT COUNT(DISTINCT lsh.contact_id) INTO v_conversions
  FROM lead_status_history lsh
  INNER JOIN conversations c ON c.contact_id = lsh.contact_id AND c.tenant_id = v_user_tenant
  WHERE lsh.tenant_id = v_user_tenant
    AND lsh.new_status = ANY(v_conversion_names)
    AND lsh.changed_at >= p_date_from
    AND lsh.changed_at <= p_date_to
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  v_metrics := jsonb_build_object(
    'total_conversations', v_total_conversations,
    'total_assigned', v_total_assigned,
    'total_unassigned', v_total_conversations - v_total_assigned,
    'total_responded', v_total_responded,
    'avg_time_to_assignment', v_avg_assignment_time,
    'avg_time_to_first_response', v_avg_response_time,
    'assignment_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_total_assigned::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END,
    'response_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_total_responded::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END,
    'conversions', v_conversions,
    'conversion_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_conversions::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END
  );

  -- =====================================================
  -- DADOS POR ORIGEM - COM TENANT FILTER
  -- =====================================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_origin_data
  FROM (
    SELECT 
      COALESCE(
        CASE 
          WHEN c.referral_source = 'meta_ads' THEN 'meta_ads'
          WHEN ct.origin = 'linktree' THEN 'linktree'
          WHEN ct.origin = 'manual' THEN 'manual'
          ELSE 'organic'
        END,
        'organic'
      ) as origin,
      COUNT(DISTINCT c.id) as total,
      COUNT(DISTINCT CASE WHEN ct.lead_status = ANY(v_conversion_names) THEN c.id END) as converted
    FROM conversations c
    LEFT JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_user_tenant
    WHERE c.tenant_id = v_user_tenant
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY 1
    ORDER BY total DESC
  ) t;

  -- =====================================================
  -- FUNIL DE STATUS - COM TENANT FILTER
  -- =====================================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_status_funnel
  FROM (
    SELECT 
      ls.name as stage,
      ls.color,
      ls.order_position,
      COUNT(DISTINCT ct.id) as count,
      COALESCE(AVG(
        CASE WHEN lsh_next.changed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (lsh_next.changed_at - lsh.changed_at))
        ELSE NULL END
      )::INTEGER, 0) as avg_duration
    FROM lead_statuses ls
    LEFT JOIN contacts ct ON ct.lead_status = ls.name AND ct.tenant_id = v_user_tenant
    LEFT JOIN conversations cv ON cv.contact_id = ct.id AND cv.tenant_id = v_user_tenant
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    LEFT JOIN lead_status_history lsh ON lsh.contact_id = ct.id 
      AND lsh.new_status = ls.name 
      AND lsh.tenant_id = v_user_tenant
    LEFT JOIN LATERAL (
      SELECT changed_at 
      FROM lead_status_history 
      WHERE contact_id = ct.id 
        AND changed_at > lsh.changed_at
        AND tenant_id = v_user_tenant
      ORDER BY changed_at ASC 
      LIMIT 1
    ) lsh_next ON true
    WHERE ls.tenant_id = v_user_tenant
      AND ls.is_active = true
    GROUP BY ls.id, ls.name, ls.color, ls.order_position
    ORDER BY ls.order_position
  ) t;

  -- =====================================================
  -- ALERTAS (conversas em espera > 5min) - COM TENANT FILTER
  -- =====================================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_alerts
  FROM (
    SELECT 
      c.id,
      ct.full_name as contact_name,
      c.last_message_at,
      EXTRACT(EPOCH FROM (NOW() - c.last_message_at))::INTEGER as waiting_seconds
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_user_tenant
    WHERE c.tenant_id = v_user_tenant
      AND c.status = 'open'
      AND c.last_message_is_from_me = false
      AND c.last_message_at < NOW() - INTERVAL '5 minutes'
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.last_message_at ASC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'origin_data', v_origin_data,
    'status_funnel', v_status_funnel,
    'alerts', v_alerts
  );
END;
$function$;