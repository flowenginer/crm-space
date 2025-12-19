
-- Drop and recreate the function with the correct logic
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_leads integer;
  assigned_leads integer;
  converted_leads integer;
  avg_assignment_time numeric;
  avg_response_time numeric;
  avg_conversion_time numeric;
  total_value numeric;
BEGIN
  -- Count total leads in period
  SELECT COUNT(DISTINCT c.id)
  INTO total_leads
  FROM contacts c
  INNER JOIN conversations cv ON cv.contact_id = c.id
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Count assigned leads (conversations with assigned_to not null)
  SELECT COUNT(DISTINCT c.id)
  INTO assigned_leads
  FROM contacts c
  INNER JOIN conversations cv ON cv.contact_id = c.id
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Count converted leads - JOIN with lead_statuses to match by name
  SELECT COUNT(DISTINCT c.id)
  INTO converted_leads
  FROM contacts c
  INNER JOIN conversations cv ON cv.contact_id = c.id
  INNER JOIN company_settings cs ON true
  INNER JOIN lead_statuses ls ON ls.id = ANY(cs.conversion_status_ids)
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.lead_status = ls.name
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Calculate average assignment time (time from conversation creation to first assignment)
  SELECT AVG(EXTRACT(EPOCH FROM (ce.created_at - cv.created_at)))
  INTO avg_assignment_time
  FROM conversations cv
  INNER JOIN contacts c ON c.id = cv.contact_id
  INNER JOIN conversation_events ce ON ce.conversation_id = cv.id AND ce.event_type = 'assignment'
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
    AND ce.created_at = (
      SELECT MIN(ce2.created_at)
      FROM conversation_events ce2
      WHERE ce2.conversation_id = cv.id AND ce2.event_type = 'assignment'
    );

  -- Calculate average response time (time to first response)
  SELECT AVG(EXTRACT(EPOCH FROM (cv.first_response_at - cv.created_at)))
  INTO avg_response_time
  FROM conversations cv
  INNER JOIN contacts c ON c.id = cv.contact_id
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Calculate average conversion time (time from creation to conversion status)
  SELECT AVG(EXTRACT(EPOCH FROM (cv.updated_at - cv.created_at)))
  INTO avg_conversion_time
  FROM conversations cv
  INNER JOIN contacts c ON c.id = cv.contact_id
  INNER JOIN company_settings cs ON true
  INNER JOIN lead_statuses ls ON ls.id = ANY(cs.conversion_status_ids)
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.lead_status = ls.name
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Calculate total negotiated value for converted leads
  SELECT COALESCE(SUM(c.negotiated_value), 0)
  INTO total_value
  FROM contacts c
  INNER JOIN conversations cv ON cv.contact_id = c.id
  INNER JOIN company_settings cs ON true
  INNER JOIN lead_statuses ls ON ls.id = ANY(cs.conversion_status_ids)
  WHERE c.created_at >= p_start_date
    AND c.created_at < p_end_date
    AND cv.lead_status = ls.name
    AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR cv.department_id = p_department_id)
    AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id);

  -- Build result
  result := jsonb_build_object(
    'total_leads', COALESCE(total_leads, 0),
    'assigned_leads', COALESCE(assigned_leads, 0),
    'converted_leads', COALESCE(converted_leads, 0),
    'assignment_rate', CASE WHEN total_leads > 0 THEN ROUND((assigned_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
    'conversion_rate', CASE WHEN total_leads > 0 THEN ROUND((converted_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
    'avg_assignment_time_seconds', COALESCE(ROUND(avg_assignment_time), 0),
    'avg_response_time_seconds', COALESCE(ROUND(avg_response_time), 0),
    'avg_conversion_time_seconds', COALESCE(ROUND(avg_conversion_time), 0),
    'total_value', COALESCE(total_value, 0)
  );

  RETURN result;
END;
$$;
