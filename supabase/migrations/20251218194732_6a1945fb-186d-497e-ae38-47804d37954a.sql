DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_lead_journey_metrics'
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s);', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_origin TEXT DEFAULT NULL
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_contacts AS (
    SELECT DISTINCT
      ct.id AS contact_id,
      ct.assigned_to,
      ct.lead_status
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    -- CORREÇÃO: usar conversations.created_at
    WHERE cv.created_at BETWEEN p_date_from AND p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        OR (p_origin = 'meta_ads' AND cv.referral_source = 'meta_ads')
        OR (p_origin = 'organic' AND (cv.referral_source IS NULL OR cv.referral_source != 'meta_ads'))
        OR (p_origin NOT IN ('meta_ads','organic','all') AND cv.referral_source = p_origin)
      )
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
      EXTRACT(EPOCH FROM (cv.first_response_at - cv.created_at))::INTEGER AS response_seconds
    FROM conversations cv
    INNER JOIN filtered_contacts fc ON fc.contact_id = cv.contact_id
    WHERE cv.first_response_at IS NOT NULL
      AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        OR (p_origin = 'meta_ads' AND cv.referral_source = 'meta_ads')
        OR (p_origin = 'organic' AND (cv.referral_source IS NULL OR cv.referral_source != 'meta_ads'))
        OR (p_origin NOT IN ('meta_ads','organic','all') AND cv.referral_source = p_origin)
      )
  ),
  stats AS (
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (WHERE fc.assigned_to IS NOT NULL) AS assigned_count,
      COUNT(*) FILTER (WHERE fc.assigned_to IS NULL) AS unassigned_count,
      COUNT(*) FILTER (WHERE fc.lead_status = ANY(p_conversion_status_names)) AS conversion_count
    FROM filtered_contacts fc
  )
  SELECT
    COALESCE(AVG(at.time_to_assign_seconds), 0)::INTEGER AS avg_time_to_assignment,
    COALESCE(AVG(rt.response_seconds), 0)::INTEGER AS avg_time_to_first_response,
    COALESCE(s.assigned_count, 0)::BIGINT AS total_assigned,
    COALESCE(s.unassigned_count, 0)::BIGINT AS total_unassigned,
    CASE
      WHEN s.total_leads > 0 THEN ROUND((s.assigned_count::NUMERIC / s.total_leads::NUMERIC) * 100, 1)
      ELSE 0
    END AS assignment_rate,
    CASE
      WHEN s.assigned_count > 0 THEN ROUND((SELECT COUNT(*)::NUMERIC FROM response_times) / s.assigned_count::NUMERIC * 100, 1)
      ELSE 0
    END AS lead_response_rate,
    COALESCE(s.conversion_count, 0)::BIGINT AS conversions,
    CASE
      WHEN s.total_leads > 0 THEN ROUND((s.conversion_count::NUMERIC / s.total_leads::NUMERIC) * 100, 1)
      ELSE 0
    END AS conversion_rate
  FROM stats s
  LEFT JOIN assignment_times at ON true
  LEFT JOIN response_times rt ON true
  GROUP BY s.total_leads, s.assigned_count, s.unassigned_count, s.conversion_count;
END;
$function$;
