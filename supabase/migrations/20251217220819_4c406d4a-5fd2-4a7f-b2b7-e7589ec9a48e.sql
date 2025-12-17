
-- Fix ambiguous column reference in get_leads_distribution_by_agent
CREATE OR REPLACE FUNCTION public.get_leads_distribution_by_agent(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  agent_avatar TEXT,
  lead_count BIGINT,
  converted_count BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH contact_with_agent AS (
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      COALESCE(ct.assigned_to, cv.assigned_to) as contact_agent_id,
      ct.lead_status,
      CASE
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        ELSE 'organic'
      END as detected_origin
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
    ORDER BY ct.id, cv.last_message_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT 
      cwa.contact_id, 
      cwa.contact_agent_id, 
      cwa.lead_status, 
      cwa.detected_origin
    FROM contact_with_agent cwa
    WHERE cwa.contact_agent_id IS NOT NULL
      AND (p_origin IS NULL OR cwa.detected_origin = p_origin)
  )
  SELECT
    pr.id as agent_id,
    pr.full_name as agent_name,
    pr.avatar_url as agent_avatar,
    COUNT(fc.contact_id)::BIGINT as lead_count,
    COUNT(fc.contact_id) FILTER (
      WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado')
    )::BIGINT as converted_count,
    CASE 
      WHEN COUNT(fc.contact_id) > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado'))::NUMERIC 
        / COUNT(*)::NUMERIC) * 100, 1
      )
      ELSE 0
    END as conversion_rate
  FROM profiles pr
  INNER JOIN filtered_contacts fc ON fc.contact_agent_id = pr.id
  WHERE pr.is_active = true
  GROUP BY pr.id, pr.full_name, pr.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$$;
