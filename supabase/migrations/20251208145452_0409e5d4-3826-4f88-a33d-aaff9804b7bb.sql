-- 1. get_leads_by_origin - Leads agrupados por origem com conversões
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
  origin TEXT,
  total BIGINT,
  converted BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH conversation_origins AS (
    SELECT 
      c.contact_id,
      CASE 
        WHEN c.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN c.referral_source = 'linktree' THEN 'linktree'
        WHEN c.referral_source = 'manual' THEN 'manual'
        WHEN c.referral_source IS NULL OR c.referral_source = 'organic' THEN 'organic'
        ELSE 'other'
      END as origin_type
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ),
  origin_totals AS (
    SELECT 
      co.origin_type,
      COUNT(DISTINCT co.contact_id) as total_count,
      ARRAY_AGG(DISTINCT co.contact_id) as contact_ids
    FROM conversation_origins co
    GROUP BY co.origin_type
  ),
  converted_contacts AS (
    SELECT DISTINCT lsh.contact_id
    FROM lead_status_history lsh
    WHERE lsh.new_status = ANY(p_conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
  )
  SELECT 
    ot.origin_type as origin,
    ot.total_count as total,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM unnest(ot.contact_ids) AS cid 
       WHERE cid IN (SELECT cc.contact_id FROM converted_contacts cc)
      ), 0::BIGINT
    ) as converted
  FROM origin_totals ot
  ORDER BY ot.total_count DESC;
END;
$$;

-- 4. get_status_funnel - Funil de status
CREATE OR REPLACE FUNCTION public.get_status_funnel(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE(
  status_name TEXT,
  status_count BIGINT,
  avg_duration INTEGER,
  color TEXT,
  order_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH status_durations AS (
    SELECT 
      lsh.previous_status,
      AVG(lsh.duration_seconds)::INTEGER as avg_dur
    FROM lead_status_history lsh
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND lsh.duration_seconds IS NOT NULL
    GROUP BY lsh.previous_status
  ),
  contact_statuses AS (
    SELECT 
      ct.lead_status,
      COUNT(*)::BIGINT as cnt
    FROM contacts ct
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
    GROUP BY ct.lead_status
  )
  SELECT 
    ls.name as status_name,
    COALESCE(cs.cnt, 0::BIGINT) as status_count,
    COALESCE(sd.avg_dur, 0) as avg_duration,
    ls.color,
    ls.order_position
  FROM lead_statuses ls
  LEFT JOIN contact_statuses cs ON cs.lead_status = ls.name
  LEFT JOIN status_durations sd ON sd.previous_status = ls.name
  WHERE ls.is_active = true
  ORDER BY ls.order_position;
END;
$$;

-- 5. get_lead_alerts - Alertas de leads que precisam atenção
CREATE OR REPLACE FUNCTION public.get_lead_alerts(
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  alert_type TEXT,
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  conversation_id UUID,
  waiting_minutes INTEGER,
  lead_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.status = 'open'
      AND c.assigned_to IS NULL
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
      (EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.status = 'open'
      AND c.first_response_at IS NULL
      AND c.assigned_to IS NOT NULL
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND c.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY c.created_at ASC
    LIMIT p_limit / 4
  )
  UNION ALL
  (
    SELECT 
      'sla_critical'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.status = 'open'
      AND c.sla_status = 'critical'
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.last_message_at ASC
    LIMIT p_limit / 4
  )
  UNION ALL
  (
    SELECT 
      'stalled'::TEXT as alert_type,
      ct.id as contact_id,
      ct.full_name as contact_name,
      ct.phone as contact_phone,
      c.id as conversation_id,
      (EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60)::INTEGER as waiting_minutes,
      ct.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.status = 'open'
      AND c.last_message_at < NOW() - INTERVAL '48 hours'
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    ORDER BY c.last_message_at ASC
    LIMIT p_limit / 4
  )
  LIMIT p_limit;
END;
$$;

-- 7. get_conversion_timeline - Timeline de conversões
CREATE OR REPLACE FUNCTION public.get_conversion_timeline(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
  date_day DATE,
  new_leads BIGINT,
  conversions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_leads AS (
    SELECT 
      DATE(c.created_at) as lead_date,
      COUNT(DISTINCT c.contact_id)::BIGINT as lead_count
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY DATE(c.created_at)
  ),
  daily_conversions AS (
    SELECT 
      DATE(lsh.changed_at) as conv_date,
      COUNT(DISTINCT lsh.contact_id)::BIGINT as conv_count
    FROM lead_status_history lsh
    WHERE lsh.new_status = ANY(p_conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
    GROUP BY DATE(lsh.changed_at)
  )
  SELECT 
    COALESCE(dl.lead_date, dc.conv_date) as date_day,
    COALESCE(dl.lead_count, 0::BIGINT) as new_leads,
    COALESCE(dc.conv_count, 0::BIGINT) as conversions
  FROM daily_leads dl
  FULL OUTER JOIN daily_conversions dc ON dc.conv_date = dl.lead_date
  ORDER BY date_day;
END;
$$;