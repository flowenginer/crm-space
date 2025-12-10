-- Corrigir get_status_funnel: Tempo Real - conta leads ATUALMENTE em cada status
CREATE OR REPLACE FUNCTION public.get_status_funnel(
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to timestamp with time zone DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(
  status_name text,
  lead_count bigint,
  avg_duration_seconds numeric,
  status_color text,
  status_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH current_counts AS (
    -- Conta leads ATUALMENTE em cada status (ignora filtros de data para tempo real)
    SELECT 
      COALESCE(c.lead_status, 'new') as current_status,
      COUNT(DISTINCT c.id) as cnt
    FROM contacts c
    WHERE (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_origin IS NULL OR c.origin = p_origin)
    GROUP BY COALESCE(c.lead_status, 'new')
  ),
  -- Calcular duração média no status atual (tempo desde última mudança)
  duration_calc AS (
    SELECT
      COALESCE(c.lead_status, 'new') as current_status,
      AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(c.updated_at, c.created_at))))::NUMERIC as avg_duration
    FROM contacts c
    WHERE (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_origin IS NULL OR c.origin = p_origin)
    GROUP BY COALESCE(c.lead_status, 'new')
  )
  SELECT 
    ls.name::TEXT as status_name,
    COALESCE(cc.cnt, 0)::BIGINT as lead_count,
    COALESCE(dc.avg_duration, 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN current_counts cc ON cc.current_status = ls.name
  LEFT JOIN duration_calc dc ON dc.current_status = ls.name
  WHERE ls.is_active = true
  ORDER BY ls.order_position;
END;
$function$;

-- Corrigir get_status_funnel_historical: conta leads que PASSARAM por cada status no período
CREATE OR REPLACE FUNCTION public.get_status_funnel_historical(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(
  status_name text,
  lead_count bigint,
  avg_duration_seconds numeric,
  status_color text,
  status_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH leads_that_passed AS (
    -- Leads que ENTRARAM em cada status (mudaram PARA esse status) no período
    SELECT 
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
  ),
  -- Também contar leads CRIADOS no período como tendo passado por "new"
  new_leads AS (
    SELECT 
      'new'::TEXT as status_name,
      ct.id as contact_id,
      NULL::INTEGER as duration_seconds
    FROM contacts ct
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
      AND (p_origin IS NULL OR ct.origin = p_origin)
      -- Excluir se já tem histórico de mudança DE new (para não duplicar)
      AND NOT EXISTS (
        SELECT 1 FROM lead_status_history lsh2 
        WHERE lsh2.contact_id = ct.id 
        AND lsh2.previous_status = 'new'
        AND lsh2.changed_at >= p_date_from
        AND lsh2.changed_at <= p_date_to
      )
  ),
  all_passages AS (
    SELECT * FROM leads_that_passed
    UNION ALL
    SELECT * FROM new_leads
  ),
  aggregated AS (
    SELECT 
      ap.status_name,
      COUNT(DISTINCT ap.contact_id) as lead_count,
      AVG(ap.duration_seconds) as avg_duration
    FROM all_passages ap
    GROUP BY ap.status_name
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
$function$;