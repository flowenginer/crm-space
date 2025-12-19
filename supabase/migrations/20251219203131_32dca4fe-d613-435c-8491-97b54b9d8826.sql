-- Dropar a versão existente que está causando conflito
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, TEXT);

-- Recriar a função com a assinatura correta
CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_conversion_status_names TEXT[];
BEGIN
  -- Buscar os nomes dos status de conversão do company_settings
  SELECT ARRAY(
    SELECT ls.name
    FROM company_settings cs
    CROSS JOIN LATERAL unnest(cs.conversion_status_ids) AS csid
    JOIN lead_statuses ls ON ls.id::text = csid
    LIMIT 1
  ) INTO v_conversion_status_names;
  
  -- Se não encontrou, usar array vazio
  IF v_conversion_status_names IS NULL THEN
    v_conversion_status_names := ARRAY[]::TEXT[];
  END IF;

  SELECT json_build_object(
    'total_leads', (
      SELECT COUNT(DISTINCT c.contact_id)
      FROM conversations c
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR EXISTS (
          SELECT 1 FROM contacts ct WHERE ct.id = c.contact_id AND ct.origin = p_origin
        ))
    ),
    'new_leads', (
      SELECT COUNT(*)
      FROM contacts ct
      WHERE ct.created_at >= p_date_from
        AND ct.created_at < p_date_to
        AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR ct.department_id = p_department_id)
        AND (p_origin IS NULL OR ct.origin = p_origin)
    ),
    'assigned_leads', (
      SELECT COUNT(*)
      FROM contacts ct
      WHERE ct.created_at >= p_date_from
        AND ct.created_at < p_date_to
        AND ct.assigned_to IS NOT NULL
        AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR ct.department_id = p_department_id)
        AND (p_origin IS NULL OR ct.origin = p_origin)
    ),
    'converted_leads', (
      SELECT COUNT(DISTINCT c.contact_id)
      FROM conversations c
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.lead_status IS NOT NULL
        AND c.lead_status IN (SELECT unnest(v_conversion_status_names))
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR EXISTS (
          SELECT 1 FROM contacts ct WHERE ct.id = c.contact_id AND ct.origin = p_origin
        ))
    ),
    'total_converted_value', (
      SELECT COALESCE(SUM(ct.negotiated_value), 0)
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.lead_status IS NOT NULL
        AND c.lead_status IN (SELECT unnest(v_conversion_status_names))
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR ct.origin = p_origin)
    ),
    'avg_first_response_seconds', (
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))), 0)
      FROM conversations c
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.first_response_at IS NOT NULL
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    ),
    'avg_resolution_seconds', (
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.closed_at - c.created_at))), 0)
      FROM conversations c
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.closed_at IS NOT NULL
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    ),
    'returning_rate', (
      SELECT CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE ct.first_contact_at < p_date_from)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      END
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    )
  ) INTO result;

  RETURN result;
END;
$$;