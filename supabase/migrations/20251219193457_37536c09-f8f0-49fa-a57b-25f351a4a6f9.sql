-- Drop and recreate the get_lead_journey_metrics function with correct conversion logic
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  avg_time_to_assignment NUMERIC,
  avg_time_to_first_response NUMERIC,
  total_assigned BIGINT,
  total_unassigned BIGINT,
  assignment_rate NUMERIC,
  lead_response_rate NUMERIC,
  conversions BIGINT,
  conversion_rate NUMERIC,
  total_converted_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion_status_names TEXT[];
BEGIN
  -- Get conversion status names from company_settings if not provided
  IF array_length(p_conversion_status_names, 1) IS NULL OR array_length(p_conversion_status_names, 1) = 0 THEN
    SELECT ARRAY(
      SELECT ls.name
      FROM lead_statuses ls
      INNER JOIN company_settings cs ON ls.id = ANY(cs.conversion_status_ids)
      LIMIT 1
    ) INTO v_conversion_status_names;
  ELSE
    v_conversion_status_names := p_conversion_status_names;
  END IF;

  -- If still empty, use empty array
  IF v_conversion_status_names IS NULL THEN
    v_conversion_status_names := ARRAY[]::TEXT[];
  END IF;

  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.id,
      c.contact_id,
      c.assigned_to,
      c.created_at,
      c.first_response_at,
      c.status,
      c.lead_status,
      ct.negotiated_value
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
  ),
  assignment_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) AS assigned_count,
      COUNT(*) FILTER (WHERE assigned_to IS NULL) AS unassigned_count,
      COUNT(*) AS total_count,
      AVG(
        CASE 
          WHEN assigned_to IS NOT NULL AND first_response_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (first_response_at - created_at))
        END
      ) AS avg_assignment_time,
      AVG(
        CASE 
          WHEN first_response_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (first_response_at - created_at))
        END
      ) AS avg_first_response_time
    FROM base_conversations
  ),
  response_metrics AS (
    SELECT
      COUNT(DISTINCT bc.contact_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = bc.id 
            AND m.is_from_me = false
        )
      ) AS leads_responded_count,
      COUNT(DISTINCT bc.contact_id) AS total_leads
    FROM base_conversations bc
  ),
  conversion_metrics AS (
    SELECT
      COUNT(*) AS conversion_count,
      COALESCE(SUM(bc.negotiated_value), 0) AS converted_value
    FROM base_conversations bc
    WHERE bc.lead_status = ANY(v_conversion_status_names)
  )
  SELECT
    COALESCE(am.avg_assignment_time, 0)::NUMERIC AS avg_time_to_assignment,
    COALESCE(am.avg_first_response_time, 0)::NUMERIC AS avg_time_to_first_response,
    COALESCE(am.assigned_count, 0)::BIGINT AS total_assigned,
    COALESCE(am.unassigned_count, 0)::BIGINT AS total_unassigned,
    CASE 
      WHEN am.total_count > 0 THEN (am.assigned_count::NUMERIC / am.total_count * 100)
      ELSE 0
    END AS assignment_rate,
    CASE 
      WHEN rm.total_leads > 0 THEN (rm.leads_responded_count::NUMERIC / rm.total_leads * 100)
      ELSE 0
    END AS lead_response_rate,
    COALESCE(cm.conversion_count, 0)::BIGINT AS conversions,
    CASE 
      WHEN am.total_count > 0 THEN (cm.conversion_count::NUMERIC / am.total_count * 100)
      ELSE 0
    END AS conversion_rate,
    COALESCE(cm.converted_value, 0)::NUMERIC AS total_converted_value
  FROM assignment_metrics am
  CROSS JOIN response_metrics rm
  CROSS JOIN conversion_metrics cm;
END;
$$;