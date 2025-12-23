-- DROP das funções existentes para permitir recriação com mesma assinatura
DROP FUNCTION IF EXISTS public.get_funnel_data_batch(timestamp with time zone, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_leads_by_status_batch(timestamp with time zone, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_timeline_data_batch(timestamp with time zone, timestamp with time zone, uuid, uuid, text[]);
DROP FUNCTION IF EXISTS public.get_conversion_timeline(timestamp with time zone, timestamp with time zone, uuid, uuid, text[]);

-- Recriar get_funnel_data_batch com filtro de tenant_id
CREATE FUNCTION public.get_funnel_data_batch(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL
)
RETURNS TABLE(stage_name text, stage_color text, order_position integer, count bigint, avg_duration_seconds numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  SELECT 
    ls.name as stage_name,
    COALESCE(ls.color, '#6B7280') as stage_color,
    ls.order_position,
    COUNT(DISTINCT c.id) as count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (
      CASE 
        WHEN c.closed_at IS NOT NULL THEN c.closed_at - c.created_at
        ELSE now() - c.created_at
      END
    ))), 0)::numeric as avg_duration_seconds
  FROM lead_statuses ls
  LEFT JOIN conversations c ON c.lead_status = ls.id::text
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.tenant_id = v_tenant_id
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  WHERE ls.tenant_id = v_tenant_id
    AND ls.is_active = true
  GROUP BY ls.id, ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$$;

-- Recriar get_leads_by_status_batch com filtro de tenant_id
CREATE FUNCTION public.get_leads_by_status_batch(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL
)
RETURNS TABLE(status_id uuid, status_name text, status_color text, order_position integer, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  SELECT 
    ls.id as status_id,
    ls.name as status_name,
    COALESCE(ls.color, '#6B7280') as status_color,
    ls.order_position,
    COUNT(c.id) as count
  FROM lead_statuses ls
  LEFT JOIN conversations c ON c.lead_status = ls.id::text
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.tenant_id = v_tenant_id
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  WHERE ls.tenant_id = v_tenant_id
    AND ls.is_active = true
  GROUP BY ls.id, ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$$;

-- Recriar get_timeline_data_batch com filtro de tenant_id
CREATE FUNCTION public.get_timeline_data_batch(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(date date, new_leads bigint, conversions bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_conversion_status_ids uuid[];
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Get conversion status IDs from names or company settings
  IF array_length(p_conversion_status_names, 1) > 0 THEN
    SELECT array_agg(id) INTO v_conversion_status_ids
    FROM lead_statuses
    WHERE name = ANY(p_conversion_status_names)
      AND tenant_id = v_tenant_id;
  ELSE
    SELECT ARRAY(
      SELECT unnest(conversion_status_ids)::uuid
      FROM company_settings
      WHERE tenant_id = v_tenant_id
    ) INTO v_conversion_status_ids;
  END IF;
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_date_from::date,
      p_date_to::date,
      '1 day'::interval
    )::date as d
  ),
  daily_stats AS (
    SELECT 
      c.created_at::date as day,
      COUNT(*) as new_count,
      COUNT(*) FILTER (WHERE c.lead_status::uuid = ANY(v_conversion_status_ids)) as conversion_count
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND c.tenant_id = v_tenant_id
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY c.created_at::date
  )
  SELECT 
    ds.d as date,
    COALESCE(st.new_count, 0) as new_leads,
    COALESCE(st.conversion_count, 0) as conversions
  FROM date_series ds
  LEFT JOIN daily_stats st ON ds.d = st.day
  ORDER BY ds.d;
END;
$$;

-- Recriar get_conversion_timeline com filtro de tenant_id
CREATE FUNCTION public.get_conversion_timeline(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(date_day date, new_leads bigint, conversions bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_conversion_status_ids uuid[];
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Get conversion status IDs from names or company settings
  IF array_length(p_conversion_status_names, 1) > 0 THEN
    SELECT array_agg(id) INTO v_conversion_status_ids
    FROM lead_statuses
    WHERE name = ANY(p_conversion_status_names)
      AND tenant_id = v_tenant_id;
  ELSE
    SELECT ARRAY(
      SELECT unnest(conversion_status_ids)::uuid
      FROM company_settings
      WHERE tenant_id = v_tenant_id
    ) INTO v_conversion_status_ids;
  END IF;
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_date_from::date,
      p_date_to::date,
      '1 day'::interval
    )::date as d
  ),
  daily_stats AS (
    SELECT 
      c.created_at::date as day,
      COUNT(*) as new_count,
      COUNT(*) FILTER (WHERE c.lead_status::uuid = ANY(v_conversion_status_ids)) as conversion_count
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND c.tenant_id = v_tenant_id
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY c.created_at::date
  )
  SELECT 
    ds.d as date_day,
    COALESCE(st.new_count, 0) as new_leads,
    COALESCE(st.conversion_count, 0) as conversions
  FROM date_series ds
  LEFT JOIN daily_stats st ON ds.d = st.day
  ORDER BY ds.d;
END;
$$;