
-- Corrigir get_lead_journey_metrics para usar conversations.created_at em vez de contacts.created_at
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_leads BIGINT,
  avg_time_to_assignment NUMERIC,
  avg_first_response NUMERIC,
  avg_time_to_conversion NUMERIC,
  assignment_rate NUMERIC,
  response_rate NUMERIC,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH lead_metrics AS (
    SELECT 
      cv.id as conversation_id,
      cv.contact_id,
      cv.created_at as conversation_created_at,
      cv.assigned_to,
      cv.first_response_at,
      ct.lead_status,
      -- Tempo até atribuição (em segundos)
      CASE 
        WHEN cv.assigned_to IS NOT NULL THEN
          EXTRACT(EPOCH FROM (
            COALESCE(
              (SELECT MIN(changed_at) FROM lead_assignment_history WHERE conversation_id = cv.id),
              cv.updated_at
            ) - cv.created_at
          ))
        ELSE NULL
      END as time_to_assignment,
      -- Tempo até primeira resposta (em segundos)
      CASE 
        WHEN cv.first_response_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (cv.first_response_at - cv.created_at))
        ELSE NULL
      END as time_to_first_response
    FROM conversations cv
    INNER JOIN contacts ct ON ct.id = cv.contact_id
    -- CORREÇÃO: Usar conversations.created_at em vez de contacts.created_at
    WHERE cv.created_at BETWEEN p_date_from AND p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
      AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
  ),
  conversion_status_ids AS (
    SELECT UNNEST(conversion_status_ids) as status_id
    FROM company_settings
    LIMIT 1
  ),
  converted_leads AS (
    SELECT DISTINCT lm.contact_id
    FROM lead_metrics lm
    INNER JOIN contacts ct ON ct.id = lm.contact_id
    WHERE ct.lead_status IN (SELECT status_id FROM conversion_status_ids)
  )
  SELECT 
    COUNT(DISTINCT lm.conversation_id)::BIGINT as total_leads,
    COALESCE(AVG(lm.time_to_assignment), 0)::NUMERIC as avg_time_to_assignment,
    COALESCE(AVG(lm.time_to_first_response), 0)::NUMERIC as avg_first_response,
    0::NUMERIC as avg_time_to_conversion,
    (COUNT(DISTINCT CASE WHEN lm.assigned_to IS NOT NULL THEN lm.conversation_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT lm.conversation_id), 0) * 100)::NUMERIC as assignment_rate,
    (COUNT(DISTINCT CASE WHEN lm.time_to_first_response IS NOT NULL THEN lm.conversation_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT lm.conversation_id), 0) * 100)::NUMERIC as response_rate,
    (COUNT(DISTINCT cl.contact_id)::NUMERIC / 
     NULLIF(COUNT(DISTINCT lm.contact_id), 0) * 100)::NUMERIC as conversion_rate
  FROM lead_metrics lm
  LEFT JOIN converted_leads cl ON cl.contact_id = lm.contact_id;
END;
$$;
