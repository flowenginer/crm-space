-- Atualizar função get_lead_journey_metrics para aceitar filtro de origem
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[],
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  avg_time_to_assignment integer, 
  avg_time_to_first_response integer,
  total_assigned bigint,
  total_unassigned bigint,
  assignment_rate numeric,
  lead_response_rate numeric,
  conversions bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_contacts AS (
    SELECT DISTINCT ct.id as contact_id, ct.assigned_to, ct.lead_status
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.created_at BETWEEN p_date_from AND p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR cv.referral_source = p_origin)
  ),
  assignment_times AS (
    SELECT 
      lah.contact_id,
      lah.time_to_assign_seconds
    FROM lead_assignment_history lah
    INNER JOIN filtered_contacts fc ON fc.contact_id = lah.contact_id
    WHERE lah.assignment_type = 'first_assignment'
  ),
  response_times AS (
    SELECT 
      cv.contact_id,
      EXTRACT(EPOCH FROM (cv.first_response_at - cv.created_at))::integer as response_seconds
    FROM conversations cv
    INNER JOIN filtered_contacts fc ON fc.contact_id = cv.contact_id
    WHERE cv.first_response_at IS NOT NULL
      AND (p_origin IS NULL OR cv.referral_source = p_origin)
  ),
  stats AS (
    SELECT
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE fc.assigned_to IS NOT NULL) as assigned_count,
      COUNT(*) FILTER (WHERE fc.assigned_to IS NULL) as unassigned_count,
      COUNT(*) FILTER (WHERE fc.lead_status = ANY(p_conversion_status_names)) as conversion_count
    FROM filtered_contacts fc
  )
  SELECT
    COALESCE(AVG(at.time_to_assign_seconds), 0)::integer as avg_time_to_assignment,
    COALESCE(AVG(rt.response_seconds), 0)::integer as avg_time_to_first_response,
    COALESCE(s.assigned_count, 0)::bigint as total_assigned,
    COALESCE(s.unassigned_count, 0)::bigint as total_unassigned,
    CASE WHEN s.total_leads > 0 
      THEN ROUND((s.assigned_count::numeric / s.total_leads::numeric) * 100, 1)
      ELSE 0 
    END as assignment_rate,
    CASE WHEN s.assigned_count > 0
      THEN ROUND((SELECT COUNT(*)::numeric FROM response_times) / s.assigned_count::numeric * 100, 1)
      ELSE 0
    END as lead_response_rate,
    COALESCE(s.conversion_count, 0)::bigint as conversions,
    CASE WHEN s.total_leads > 0 
      THEN ROUND((s.conversion_count::numeric / s.total_leads::numeric) * 100, 1)
      ELSE 0 
    END as conversion_rate
  FROM stats s
  LEFT JOIN assignment_times at ON true
  LEFT JOIN response_times rt ON true
  GROUP BY s.total_leads, s.assigned_count, s.unassigned_count, s.conversion_count;
END;
$function$;