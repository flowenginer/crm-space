-- Fix Dashboard RPCs: Add tenant_id filtering to prevent data leakage between tenants

-- 1. Fix get_leads_by_origin
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(origin text, total_leads bigint, converted_leads bigint, conversion_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH lead_data AS (
    SELECT 
      COALESCE(ct.origin, 'Não identificado') as lead_origin,
      ct.id as contact_id,
      ct.lead_status
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.tenant_id = v_tenant_id
      AND ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
  )
  SELECT 
    ld.lead_origin as origin,
    COUNT(DISTINCT ld.contact_id)::BIGINT as total_leads,
    COUNT(DISTINCT CASE WHEN ld.lead_status IN ('converted', 'won', 'sale') THEN ld.contact_id END)::BIGINT as converted_leads,
    CASE 
      WHEN COUNT(DISTINCT ld.contact_id) > 0 
      THEN ROUND((COUNT(DISTINCT CASE WHEN ld.lead_status IN ('converted', 'won', 'sale') THEN ld.contact_id END)::NUMERIC / COUNT(DISTINCT ld.contact_id)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM lead_data ld
  GROUP BY ld.lead_origin
  ORDER BY total_leads DESC;
END;
$function$;

-- 2. Fix get_status_funnel
CREATE OR REPLACE FUNCTION public.get_status_funnel(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(status_name text, lead_count bigint, avg_duration_seconds numeric, status_color text, status_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 
    ls.name::TEXT as status_name,
    COUNT(c.id)::BIGINT as lead_count,
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (NOW() - c.updated_at))
    ), 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN contacts c ON c.lead_status = ls.name 
    AND c.tenant_id = v_tenant_id
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  WHERE ls.tenant_id = v_tenant_id
    AND ls.is_active = true
  GROUP BY ls.id, ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$function$;

-- 3. Fix get_status_funnel_realtime
CREATE OR REPLACE FUNCTION public.get_status_funnel_realtime(
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(status_name text, lead_count bigint, avg_duration_seconds numeric, status_color text, status_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 
    ls.name::TEXT as status_name,
    COUNT(c.id)::BIGINT as lead_count,
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (NOW() - c.updated_at))
    ), 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN contacts c ON c.lead_status = ls.name 
    AND c.tenant_id = v_tenant_id
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  WHERE ls.tenant_id = v_tenant_id
    AND ls.is_active = true
  GROUP BY ls.id, ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$function$;

-- 4. Fix get_agent_distribution_advanced
CREATE OR REPLACE FUNCTION public.get_agent_distribution_advanced(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_department_id uuid DEFAULT NULL::uuid,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  avatar_url text,
  leads_received bigint,
  leads_responded bigint,
  conversions bigint,
  conversion_rate numeric,
  avg_response_time integer,
  meta_ads_count bigint,
  organic_count bigint,
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH agent_conversations AS (
    SELECT 
      c.assigned_to,
      c.contact_id,
      c.first_response_at,
      c.created_at,
      c.referral_source
    FROM conversations c
    WHERE c.tenant_id = v_tenant_id
      AND c.assigned_to IS NOT NULL
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ),
  agent_stats AS (
    SELECT 
      ac.assigned_to,
      COUNT(*) as leads_count,
      SUM(CASE WHEN ac.first_response_at IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
      COALESCE(AVG(CASE WHEN ac.first_response_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ac.first_response_at - ac.created_at)) 
        ELSE NULL END)::INTEGER, 0) as avg_resp_time,
      SUM(CASE WHEN ac.referral_source = 'meta_ads' THEN 1 ELSE 0 END) as meta_ads,
      SUM(CASE WHEN ac.referral_source IS NULL OR ac.referral_source = 'organic' THEN 1 ELSE 0 END) as organic,
      SUM(CASE WHEN ac.referral_source IS NOT NULL AND ac.referral_source NOT IN ('meta_ads', 'organic') THEN 1 ELSE 0 END) as other_origins,
      ARRAY_AGG(DISTINCT ac.contact_id) as contact_ids
    FROM agent_conversations ac
    GROUP BY ac.assigned_to
  ),
  converted_contacts AS (
    SELECT DISTINCT lsh.contact_id
    FROM lead_status_history lsh
    INNER JOIN contacts ct ON ct.id = lsh.contact_id AND ct.tenant_id = v_tenant_id
    WHERE lsh.new_status = ANY(p_conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(ast.leads_count, 0)::BIGINT as leads_received,
    COALESCE(ast.responded_count, 0)::BIGINT as leads_responded,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM unnest(ast.contact_ids) AS cid 
       WHERE cid IN (SELECT cc.contact_id FROM converted_contacts cc)
      ), 0::BIGINT
    ) as conversions,
    CASE WHEN COALESCE(ast.leads_count, 0) > 0 
      THEN (
        COALESCE(
          (SELECT COUNT(*)::NUMERIC 
           FROM unnest(ast.contact_ids) AS cid 
           WHERE cid IN (SELECT cc.contact_id FROM converted_contacts cc)
          ), 0
        ) / ast.leads_count * 100
      ) 
      ELSE 0 
    END as conversion_rate,
    COALESCE(ast.avg_resp_time, 0)::INTEGER as avg_response_time,
    COALESCE(ast.meta_ads, 0)::BIGINT as meta_ads_count,
    COALESCE(ast.organic, 0)::BIGINT as organic_count,
    COALESCE(ast.other_origins, 0)::BIGINT as other_count
  FROM profiles p
  INNER JOIN agent_stats ast ON ast.assigned_to = p.id
  WHERE p.tenant_id = v_tenant_id
    AND p.is_active = true
    AND ast.leads_count > 0
    AND (p_department_id IS NULL OR p.department_id = p_department_id)
  ORDER BY ast.leads_count DESC;
END;
$function$;

-- 5. Fix get_lead_journey_metrics (main version with origin filter)
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  total_conversations bigint,
  new_contacts bigint,
  conversion_count bigint,
  conversion_rate numeric,
  avg_time_to_assignment numeric,
  avg_time_to_first_response numeric,
  avg_time_in_funnel numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH filtered_conversations AS (
    SELECT 
      cv.id,
      cv.contact_id,
      cv.created_at,
      cv.first_response_at,
      cv.lead_status,
      ct.first_contact_at
    FROM conversations cv
    INNER JOIN contacts ct ON ct.id = cv.contact_id AND ct.tenant_id = v_tenant_id
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        OR (p_origin = 'meta_ads' AND cv.referral_source = 'meta_ads')
        OR (p_origin = 'linktree' AND cv.referral_source = 'linktree')
        OR (p_origin = 'site' AND cv.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic_unknown' AND (
          cv.referral_source IS NULL OR cv.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic' AND (cv.referral_source IS NULL OR cv.referral_source != 'meta_ads'))
      )
  ),
  new_contacts_data AS (
    SELECT DISTINCT contact_id
    FROM filtered_conversations fc
    WHERE fc.first_contact_at >= p_date_from
      AND fc.first_contact_at <= p_date_to
  ),
  conversion_status_ids AS (
    SELECT unnest(cs.conversion_status_ids) as status_id
    FROM company_settings cs
    WHERE cs.tenant_id = v_tenant_id
  ),
  conversion_status_names AS (
    SELECT ls.name
    FROM lead_statuses ls
    WHERE ls.tenant_id = v_tenant_id
      AND ls.id IN (SELECT status_id FROM conversion_status_ids)
  ),
  conversions AS (
    SELECT DISTINCT fc.contact_id
    FROM filtered_conversations fc
    INNER JOIN lead_status_history lsh ON lsh.contact_id = fc.contact_id
    WHERE lsh.new_status IN (SELECT name FROM conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
  ),
  assignment_times AS (
    SELECT 
      lah.conversation_id,
      MIN(lah.time_to_assign_seconds) as time_to_assign
    FROM lead_assignment_history lah
    INNER JOIN filtered_conversations fc ON fc.id = lah.conversation_id
    WHERE lah.assignment_type = 'first_assignment'
    GROUP BY lah.conversation_id
  ),
  funnel_times AS (
    SELECT 
      lsh.contact_id,
      SUM(lsh.duration_seconds) as total_funnel_time
    FROM lead_status_history lsh
    INNER JOIN filtered_conversations fc ON fc.contact_id = lsh.contact_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
    GROUP BY lsh.contact_id
  )
  SELECT
    (SELECT COUNT(DISTINCT id) FROM filtered_conversations)::BIGINT as total_conversations,
    (SELECT COUNT(*) FROM new_contacts_data)::BIGINT as new_contacts,
    (SELECT COUNT(*) FROM conversions)::BIGINT as conversion_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM new_contacts_data) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM conversions)::NUMERIC / (SELECT COUNT(*) FROM new_contacts_data)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate,
    COALESCE((SELECT AVG(time_to_assign) FROM assignment_times), 0)::NUMERIC as avg_time_to_assignment,
    COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (fc.first_response_at - fc.created_at)))
      FROM filtered_conversations fc
      WHERE fc.first_response_at IS NOT NULL
    ), 0)::NUMERIC as avg_time_to_first_response,
    COALESCE((SELECT AVG(total_funnel_time) FROM funnel_times), 0)::NUMERIC as avg_time_in_funnel;
END;
$function$;