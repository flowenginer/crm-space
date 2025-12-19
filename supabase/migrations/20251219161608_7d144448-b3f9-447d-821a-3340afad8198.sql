-- Corrigir lead_response_rate: usar COUNT(DISTINCT contact_id) em vez de COUNT(*)
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(
  timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, text[], text
);

CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_channel_id uuid DEFAULT NULL::uuid,
  p_conversion_status_names text[] DEFAULT NULL::text[],
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  total_assigned bigint,
  total_unassigned bigint,
  assignment_rate numeric,
  avg_time_to_assignment numeric,
  avg_time_to_first_response numeric,
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
  WITH filtered_conversations AS (
    SELECT 
      cv.id,
      cv.contact_id,
      cv.created_at,
      cv.assigned_to,
      cv.first_response_at,
      cv.lead_status
    FROM conversations cv
    INNER JOIN contacts ct ON ct.id = cv.contact_id
    WHERE cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
      AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
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
  assigned_conversations AS (
    SELECT id, contact_id FROM filtered_conversations WHERE assigned_to IS NOT NULL
  ),
  unassigned_conversations AS (
    SELECT id, contact_id FROM filtered_conversations WHERE assigned_to IS NULL
  ),
  response_times AS (
    SELECT 
      fc.id,
      fc.contact_id,
      EXTRACT(EPOCH FROM (fc.first_response_at - fc.created_at)) as response_seconds
    FROM filtered_conversations fc
    WHERE fc.first_response_at IS NOT NULL
      AND fc.assigned_to IS NOT NULL
  ),
  assignment_times AS (
    SELECT 
      lah.time_to_assign_seconds
    FROM lead_assignment_history lah
    INNER JOIN filtered_conversations fc ON fc.id = lah.conversation_id
    WHERE lah.assignment_type = 'first_assignment'
      AND lah.time_to_assign_seconds IS NOT NULL
  ),
  conversions_data AS (
    SELECT DISTINCT fc.contact_id
    FROM filtered_conversations fc
    INNER JOIN lead_statuses ls ON ls.id::text = fc.lead_status
    WHERE p_conversion_status_names IS NOT NULL 
      AND ls.name = ANY(p_conversion_status_names)
  ),
  stats AS (
    SELECT
      (SELECT COUNT(DISTINCT contact_id) FROM assigned_conversations) as assigned_count,
      (SELECT COUNT(DISTINCT contact_id) FROM unassigned_conversations) as unassigned_count
  )
  SELECT
    s.assigned_count::BIGINT as total_assigned,
    s.unassigned_count::BIGINT as total_unassigned,
    CASE 
      WHEN (s.assigned_count + s.unassigned_count) > 0 
      THEN ROUND(s.assigned_count::NUMERIC / (s.assigned_count + s.unassigned_count)::NUMERIC * 100, 1)
      ELSE 0
    END as assignment_rate,
    COALESCE((SELECT AVG(time_to_assign_seconds) FROM assignment_times), 0)::NUMERIC as avg_time_to_assignment,
    COALESCE((SELECT AVG(response_seconds) FROM response_times), 0)::NUMERIC as avg_time_to_first_response,
    -- CORREÇÃO: Usar COUNT(DISTINCT contact_id) para não exceder 100%
    CASE 
      WHEN s.assigned_count > 0 
      THEN ROUND((SELECT COUNT(DISTINCT contact_id)::NUMERIC FROM response_times) / s.assigned_count::NUMERIC * 100, 1)
      ELSE 0
    END as lead_response_rate,
    (SELECT COUNT(*) FROM conversions_data)::BIGINT as conversions,
    CASE 
      WHEN (s.assigned_count + s.unassigned_count) > 0 
      THEN ROUND((SELECT COUNT(*) FROM conversions_data)::NUMERIC / (s.assigned_count + s.unassigned_count)::NUMERIC * 100, 1)
      ELSE 0
    END as conversion_rate
  FROM stats s;
END;
$function$;