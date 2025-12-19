-- Fix get_lead_journey_metrics overloads causing text=uuid join errors

-- 1) Fix the JSON overload used by the dashboard (includes p_channel_id)
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  v_conversion_status_names TEXT[];
  v_total_conversations BIGINT;
  v_assigned_conversations BIGINT;
BEGIN
  -- Status de conversão (nomes) a partir do company_settings
  SELECT COALESCE(array_agg(ls.name), ARRAY[]::TEXT[])
  INTO v_conversion_status_names
  FROM company_settings cs
  CROSS JOIN LATERAL unnest(cs.conversion_status_ids) AS csid
  JOIN lead_statuses ls ON ls.id = csid;

  -- Total de conversas no período (base para taxa de atribuição)
  SELECT COUNT(*)::BIGINT
  INTO v_total_conversations
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.created_at >= p_date_from
    AND c.created_at < p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (
      p_origin IS NULL OR p_origin = 'all'
      OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
      OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
      OR (p_origin = 'site' AND c.referral_source = 'site')
      OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
      OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        )
        AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
        AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
    );

  -- Conversas atribuídas no período
  SELECT COUNT(*)::BIGINT
  INTO v_assigned_conversations
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.created_at >= p_date_from
    AND c.created_at < p_date_to
    AND c.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (
      p_origin IS NULL OR p_origin = 'all'
      OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
      OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
      OR (p_origin = 'site' AND c.referral_source = 'site')
      OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
      OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        )
        AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
        AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
    );

  -- Monta resultado (mantém chaves existentes)
  result := json_build_object(
    'total_conversations', COALESCE(v_total_conversations, 0),
    'assigned_conversations', COALESCE(v_assigned_conversations, 0),
    'assignment_rate', CASE WHEN COALESCE(v_total_conversations, 0) > 0 THEN ROUND((v_assigned_conversations::numeric / v_total_conversations::numeric) * 100, 1) ELSE 0 END,
    'conversion_status_names', v_conversion_status_names
  );

  RETURN result;
END;
$function$;

-- 2) Fix the TABLE overload (our recent one) to avoid text=uuid (conversion_status_ids is uuid[])
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
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
    INNER JOIN contacts ct ON ct.id = cv.contact_id
    WHERE cv.created_at >= p_date_from
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
  conversions AS (
    SELECT DISTINCT fc.contact_id
    FROM filtered_conversations fc
    INNER JOIN company_settings cs ON true
    INNER JOIN lead_statuses ls ON ls.id = ANY(cs.conversion_status_ids)
    WHERE fc.lead_status = ls.name
  ),
  assignment_times AS (
    SELECT 
      lah.time_to_assign_seconds
    FROM lead_assignment_history lah
    INNER JOIN filtered_conversations fc ON fc.id = lah.conversation_id
    WHERE lah.assignment_type = 'first_assignment'
      AND lah.time_to_assign_seconds IS NOT NULL
  ),
  response_times AS (
    SELECT 
      EXTRACT(EPOCH FROM (fc.first_response_at - fc.created_at)) as response_seconds
    FROM filtered_conversations fc
    WHERE fc.first_response_at IS NOT NULL
  ),
  funnel_times AS (
    SELECT 
      SUM(lsh.duration_seconds) as total_duration
    FROM lead_status_history lsh
    INNER JOIN filtered_conversations fc ON fc.contact_id = lsh.contact_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
    GROUP BY lsh.contact_id
  )
  SELECT
    (SELECT COUNT(*) FROM filtered_conversations)::BIGINT as total_conversations,
    (SELECT COUNT(*) FROM new_contacts_data)::BIGINT as new_contacts,
    (SELECT COUNT(*) FROM conversions)::BIGINT as conversion_count,
    CASE 
      WHEN (SELECT COUNT(DISTINCT contact_id) FROM filtered_conversations) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM conversions)::NUMERIC / (SELECT COUNT(DISTINCT contact_id) FROM filtered_conversations)::NUMERIC) * 100, 1)
      ELSE 0
    END as conversion_rate,
    COALESCE((SELECT AVG(time_to_assign_seconds) FROM assignment_times), 0)::NUMERIC as avg_time_to_assignment,
    COALESCE((SELECT AVG(response_seconds) FROM response_times), 0)::NUMERIC as avg_time_to_first_response,
    COALESCE((SELECT AVG(total_duration) FROM funnel_times), 0)::NUMERIC as avg_time_in_funnel;
END;
$function$;
