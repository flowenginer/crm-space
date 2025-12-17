-- Drop both versions of get_status_funnel to resolve the conflict
DROP FUNCTION IF EXISTS public.get_status_funnel(timestamp with time zone, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_status_funnel(timestamp with time zone, timestamp with time zone, uuid, uuid);

-- Recreate get_status_funnel with correct signature
CREATE OR REPLACE FUNCTION public.get_status_funnel(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(
  status text,
  count bigint,
  avg_duration_seconds numeric,
  color text,
  status_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH lead_statuses AS (
    SELECT 
      ls.name as status_name,
      ls.color as status_color,
      ls.order_position as status_order
    FROM lead_statuses ls
    WHERE ls.is_active = true
  ),
  contact_stats AS (
    SELECT
      c.lead_status,
      COUNT(DISTINCT c.id) as contact_count,
      AVG(
        CASE 
          WHEN lsh.duration_seconds IS NOT NULL THEN lsh.duration_seconds
          ELSE EXTRACT(EPOCH FROM (NOW() - c.updated_at))
        END
      ) as avg_duration
    FROM contacts c
    LEFT JOIN lead_status_history lsh ON lsh.contact_id = c.id AND lsh.new_status = c.lead_status
    LEFT JOIN conversations cv ON cv.contact_id = c.id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_origin IS NULL OR c.origin = p_origin OR 
           (p_origin = 'meta_ads' AND cv.referral_source = 'meta_ads'))
    GROUP BY c.lead_status
  )
  SELECT
    COALESCE(cs.lead_status, ls.status_name)::text as status,
    COALESCE(cs.contact_count, 0)::bigint as count,
    COALESCE(cs.avg_duration, 0)::numeric as avg_duration_seconds,
    COALESCE(ls.status_color, '#6b7280')::text as color,
    COALESCE(ls.status_order, 999)::integer as status_order
  FROM lead_statuses ls
  LEFT JOIN contact_stats cs ON cs.lead_status = ls.status_name
  WHERE COALESCE(cs.contact_count, 0) > 0
  ORDER BY ls.status_order ASC NULLS LAST;
END;
$$;