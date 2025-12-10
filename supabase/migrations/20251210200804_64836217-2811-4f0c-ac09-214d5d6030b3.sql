-- Função para funil de status HISTÓRICO (leads que PASSARAM por cada status)
CREATE OR REPLACE FUNCTION get_status_funnel_historical(
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_date_to TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  status_name TEXT,
  lead_count BIGINT,
  avg_duration_seconds NUMERIC,
  status_color TEXT,
  status_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH leads_that_passed AS (
    -- Leads que ENTRARAM em cada status (mudaram para esse status)
    SELECT DISTINCT
      lsh.new_status as status_name,
      lsh.contact_id,
      lsh.duration_seconds
    FROM lead_status_history lsh
    INNER JOIN contacts ct ON ct.id = lsh.contact_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
    
    UNION ALL
    
    -- Incluir leads NOVOS que ainda não mudaram de status (estão em "new" desde criação)
    SELECT 
      COALESCE(ct.lead_status, 'new') as status_name,
      ct.id as contact_id,
      NULL::INTEGER as duration_seconds
    FROM contacts ct
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
      AND NOT EXISTS (
        SELECT 1 FROM lead_status_history lsh 
        WHERE lsh.contact_id = ct.id 
        AND lsh.changed_at >= p_date_from
        AND lsh.changed_at <= p_date_to
      )
  ),
  aggregated AS (
    SELECT 
      ltp.status_name,
      COUNT(DISTINCT ltp.contact_id) as lead_count,
      AVG(ltp.duration_seconds) as avg_duration
    FROM leads_that_passed ltp
    GROUP BY ltp.status_name
  )
  SELECT 
    ls.name::TEXT as status_name,
    COALESCE(a.lead_count, 0)::BIGINT as lead_count,
    COALESCE(a.avg_duration, 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN aggregated a ON a.status_name = ls.name
  WHERE ls.is_active = true
  ORDER BY ls.order_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;