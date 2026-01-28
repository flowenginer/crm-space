
-- Drop and recreate get_lead_intelligence_by_state with correct type casts
DROP FUNCTION IF EXISTS public.get_lead_intelligence_by_state(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_state(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone
)
RETURNS TABLE (
  state text,
  total_leads bigint,
  converted_leads bigint,
  total_revenue numeric,
  avg_ticket numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  SELECT 
    li.state,
    SUM(li.total_leads)::bigint as total_leads,
    SUM(li.converted_leads)::bigint as converted_leads,
    SUM(li.total_revenue) as total_revenue,
    ROUND(CASE WHEN SUM(li.converted_leads) > 0 THEN SUM(li.total_revenue) / SUM(li.converted_leads) ELSE 0 END, 2) as avg_ticket,
    ROUND(CASE WHEN SUM(li.total_leads) > 0 THEN (SUM(li.converted_leads)::numeric / SUM(li.total_leads)::numeric * 100) ELSE 0 END, 2) as conversion_rate
  FROM get_lead_intelligence(p_date_from, p_date_to) li
  GROUP BY li.state
  ORDER BY total_leads DESC;
END;
$$;
