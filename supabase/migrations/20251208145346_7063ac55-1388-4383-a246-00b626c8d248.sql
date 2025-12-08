-- 2. get_lead_journey_metrics - Métricas principais da jornada (CORRIGIDO)
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
  avg_time_to_assignment INTEGER,
  avg_time_to_first_response INTEGER,
  total_assigned BIGINT,
  total_unassigned BIGINT,
  assignment_rate NUMERIC,
  lead_response_rate NUMERIC,
  conversions BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_conversations BIGINT;
  v_total_assigned BIGINT;
  v_total_responded BIGINT;
  v_avg_assignment_time INTEGER;
  v_avg_response_time INTEGER;
  v_conversions BIGINT;
BEGIN
  -- Get total conversations
  SELECT COUNT(*)
  INTO v_total_conversations
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Get total assigned
  SELECT COUNT(*)
  INTO v_total_assigned
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Get total responded
  SELECT COUNT(*)
  INTO v_total_responded
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Get avg response time
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)))::INTEGER, 0)
  INTO v_avg_response_time
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Get average assignment time
  SELECT COALESCE(AVG(lah.time_to_assign_seconds)::INTEGER, 0)
  INTO v_avg_assignment_time
  FROM lead_assignment_history lah
  WHERE lah.assigned_at >= p_date_from
    AND lah.assigned_at <= p_date_to
    AND lah.assignment_type = 'first_assignment'
    AND (p_agent_id IS NULL OR lah.assigned_to = p_agent_id);

  -- Count conversions
  SELECT COUNT(DISTINCT lsh.contact_id)
  INTO v_conversions
  FROM lead_status_history lsh
  INNER JOIN conversations c ON c.contact_id = lsh.contact_id
  WHERE lsh.new_status = ANY(p_conversion_status_names)
    AND lsh.changed_at >= p_date_from
    AND lsh.changed_at <= p_date_to
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  RETURN QUERY SELECT
    v_avg_assignment_time,
    v_avg_response_time,
    v_total_assigned,
    v_total_conversations - v_total_assigned,
    CASE WHEN v_total_conversations > 0 THEN (v_total_assigned::NUMERIC / v_total_conversations * 100) ELSE 0 END,
    CASE WHEN v_total_conversations > 0 THEN (v_total_responded::NUMERIC / v_total_conversations * 100) ELSE 0 END,
    COALESCE(v_conversions, 0::BIGINT),
    CASE WHEN v_total_conversations > 0 THEN (COALESCE(v_conversions, 0)::NUMERIC / v_total_conversations * 100) ELSE 0 END;
END;
$$;

-- 3. get_agent_distribution_advanced - Distribuição por agente (CORRIGIDO sem FILTER)
CREATE OR REPLACE FUNCTION public.get_agent_distribution_advanced(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
  agent_id UUID,
  agent_name TEXT,
  avatar_url TEXT,
  leads_received BIGINT,
  leads_responded BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC,
  avg_response_time INTEGER,
  meta_ads_count BIGINT,
  organic_count BIGINT,
  other_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE c.assigned_to IS NOT NULL
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
  WHERE p.is_active = true
    AND ast.leads_count > 0
    AND (p_department_id IS NULL OR p.department_id = p_department_id)
  ORDER BY ast.leads_count DESC;
END;
$$;

-- 6. get_origin_timeline - Timeline por origem (CORRIGIDO sem FILTER)
CREATE OR REPLACE FUNCTION public.get_origin_timeline(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE(
  date_day DATE,
  meta_ads_count BIGINT,
  organic_count BIGINT,
  other_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  GROUP BY DATE(c.created_at)
  ORDER BY date_day;
END;
$$;