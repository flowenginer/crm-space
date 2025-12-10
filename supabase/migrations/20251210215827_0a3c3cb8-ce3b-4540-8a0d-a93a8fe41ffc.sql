-- Create function to get real-time status funnel (current snapshot of contacts by status)
CREATE OR REPLACE FUNCTION public.get_status_funnel_realtime(
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  status_name TEXT,
  lead_count BIGINT,
  avg_duration_seconds NUMERIC,
  status_color TEXT,
  status_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.name::TEXT as status_name,
    COUNT(c.id)::BIGINT as lead_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - c.updated_at))), 0)::NUMERIC as avg_duration_seconds,
    COALESCE(ls.color, '#6b7280')::TEXT as status_color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN contacts c ON c.lead_status = ls.name
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  WHERE ls.is_active = true
  GROUP BY ls.id, ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$$;