-- FASE 2: Adicionar tenant_id filters às RPCs restantes

-- 1. get_agents_response_status - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.get_agents_response_status()
 RETURNS TABLE(agent_id uuid, agent_name text, avatar_url text, is_available boolean, is_online boolean, department_name text, open_conversations bigint, waiting_response bigint, oldest_waiting_minutes double precision, unavailable_until timestamp with time zone, unavailability_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH agent_stats AS (
    SELECT 
      c.assigned_to,
      COUNT(*) FILTER (WHERE c.status = 'open') as open_count,
      COUNT(*) FILTER (
        WHERE c.status = 'open' 
        AND c.last_message_is_from_me = false
      ) as waiting_count,
      MAX(
        CASE 
          WHEN c.status = 'open' AND c.last_message_is_from_me = false 
          THEN EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60 
          ELSE 0 
        END
      )::double precision as oldest_minutes
    FROM conversations c
    WHERE c.assigned_to IS NOT NULL
      AND c.tenant_id = v_tenant_id
    GROUP BY c.assigned_to
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(p.is_available, true) as is_available,
    COALESCE(p.is_online, false) as is_online,
    d.name as department_name,
    COALESCE(s.open_count, 0) as open_conversations,
    COALESCE(s.waiting_count, 0) as waiting_response,
    COALESCE(s.oldest_minutes, 0::double precision) as oldest_waiting_minutes,
    p.unavailable_until,
    p.unavailability_reason
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN agent_stats s ON s.assigned_to = p.id
  WHERE p.is_active = true
    AND p.tenant_id = v_tenant_id
  ORDER BY 
    CASE WHEN COALESCE(s.waiting_count, 0) > 0 THEN 0 ELSE 1 END,
    COALESCE(s.oldest_minutes, 0) DESC,
    p.full_name;
END;
$function$;

-- 2. get_agents_response_history - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.get_agents_response_history(p_days integer DEFAULT 7)
 RETURNS TABLE(agent_id uuid, agent_name text, report_date date, total_conversations bigint, avg_response_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH first_messages AS (
    SELECT 
      c.id as conversation_id,
      c.assigned_to,
      c.created_at::DATE as conv_date,
      MIN(CASE WHEN m.is_from_me = false THEN m.created_at END) as first_client_msg,
      MIN(CASE WHEN m.is_from_me = true THEN m.created_at END) as first_agent_msg
    FROM conversations c
    INNER JOIN messages m ON m.conversation_id = c.id
    WHERE c.assigned_to IS NOT NULL
      AND c.created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND c.tenant_id = v_tenant_id
    GROUP BY c.id, c.assigned_to, c.created_at::DATE
  ),
  response_times AS (
    SELECT
      fm.assigned_to,
      fm.conv_date,
      CASE 
        WHEN fm.first_agent_msg > fm.first_client_msg 
        THEN EXTRACT(EPOCH FROM (fm.first_agent_msg - fm.first_client_msg)) / 60
        ELSE NULL
      END as response_minutes
    FROM first_messages fm
    WHERE fm.first_client_msg IS NOT NULL
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    rt.conv_date as report_date,
    COUNT(*)::BIGINT as total_conversations,
    ROUND(AVG(rt.response_minutes)::NUMERIC, 1) as avg_response_minutes
  FROM response_times rt
  INNER JOIN profiles p ON p.id = rt.assigned_to
  WHERE p.is_active = true
    AND p.tenant_id = v_tenant_id
  GROUP BY p.id, p.full_name, rt.conv_date
  ORDER BY rt.conv_date DESC, p.full_name;
END;
$function$;

-- 3. get_origin_timeline - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.get_origin_timeline(p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_agent_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(date_day date, meta_ads_count bigint, organic_count bigint, other_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 
    DATE(c.created_at) as date_day,
    SUM(CASE WHEN c.referral_source = 'meta_ads' THEN 1 ELSE 0 END)::BIGINT as meta_ads_count,
    SUM(CASE WHEN c.referral_source IS NULL OR c.referral_source = 'organic' THEN 1 ELSE 0 END)::BIGINT as organic_count,
    SUM(CASE WHEN c.referral_source IS NOT NULL AND c.referral_source NOT IN ('meta_ads', 'organic') THEN 1 ELSE 0 END)::BIGINT as other_count
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.tenant_id = v_tenant_id
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  GROUP BY DATE(c.created_at)
  ORDER BY date_day;
END;
$function$;

-- 4. get_status_funnel_historical - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.get_status_funnel_historical(p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_agent_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_origin text DEFAULT NULL::text)
 RETURNS TABLE(status_name text, lead_count bigint, avg_duration_seconds numeric, status_color text, status_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH leads_that_passed AS (
    -- Leads que ENTRARAM em cada status (mudaram PARA esse status) no período
    SELECT 
      lsh.new_status as status_name,
      lsh.contact_id,
      lsh.duration_seconds
    FROM lead_status_history lsh
    INNER JOIN contacts ct ON ct.id = lsh.contact_id AND ct.tenant_id = v_tenant_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
  ),
  -- Também contar leads CRIADOS no período como tendo passado por "new"
  new_leads AS (
    SELECT 
      'new'::TEXT as status_name,
      ct.id as contact_id,
      NULL::INTEGER as duration_seconds
    FROM contacts ct
    WHERE ct.tenant_id = v_tenant_id
      AND ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
      -- Excluir se já tem histórico de mudança DE new (para não duplicar)
      AND NOT EXISTS (
        SELECT 1 FROM lead_status_history lsh2 
        WHERE lsh2.contact_id = ct.id 
        AND lsh2.previous_status = 'new'
        AND lsh2.changed_at >= p_date_from
        AND lsh2.changed_at <= p_date_to
      )
  ),
  all_passages AS (
    SELECT * FROM leads_that_passed
    UNION ALL
    SELECT * FROM new_leads
  ),
  aggregated AS (
    SELECT 
      ap.status_name,
      COUNT(DISTINCT ap.contact_id) as lead_count,
      AVG(ap.duration_seconds) as avg_duration
    FROM all_passages ap
    GROUP BY ap.status_name
  )
  SELECT 
    ls.name::TEXT as status_name,
    COALESCE(a.lead_count, 0)::BIGINT as lead_count,
    COALESCE(a.avg_duration, 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN aggregated a ON a.status_name = ls.name
  WHERE ls.is_active = true
    AND ls.tenant_id = v_tenant_id
  ORDER BY ls.order_position;
END;
$function$;

-- 5. get_lead_alerts - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.get_lead_alerts(p_agent_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(alert_type text, contact_id uuid, contact_name text, contact_phone text, conversation_id uuid, waiting_minutes integer, lead_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  (
    SELECT 
      'unassigned'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_tenant_id
    WHERE c.status = 'open'
      AND c.assigned_to IS NULL
      AND c.tenant_id = v_tenant_id
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.created_at ASC
    LIMIT p_limit / 4
  )
  UNION ALL
  (
    SELECT 
      'no_response'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_tenant_id
    WHERE c.status = 'open'
      AND c.last_message_is_from_me = false
      AND c.last_message_at < NOW() - INTERVAL '30 minutes'
      AND c.tenant_id = v_tenant_id
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.last_message_at ASC
    LIMIT p_limit / 4
  )
  UNION ALL
  (
    SELECT 
      'high_value'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_tenant_id
    WHERE c.status = 'open'
      AND ct.negotiated_value >= 1000
      AND c.tenant_id = v_tenant_id
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY ct.negotiated_value DESC
    LIMIT p_limit / 4
  )
  UNION ALL
  (
    SELECT 
      'stale'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = v_tenant_id
    WHERE c.status = 'open'
      AND c.updated_at < NOW() - INTERVAL '24 hours'
      AND c.tenant_id = v_tenant_id
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.updated_at ASC
    LIMIT p_limit / 4
  );
END;
$function$;