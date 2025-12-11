-- Função para buscar distribuição de leads por agente para uma origem específica
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
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH contact_origins AS (
    SELECT
      ct.id as contact_id,
      ct.assigned_to,
      ct.lead_status,
      CASE
        WHEN cv.referral_source = 'meta_ads' OR ct.origin = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' OR ct.origin ILIKE '%linktree%' THEN 'linktree'
        WHEN cv.referral_source = 'site' OR ct.origin ILIKE '%site%' OR ct.origin ILIKE '%website%' THEN 'site'
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        ELSE 'organic_unknown'
      END as detected_origin
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.created_at BETWEEN p_date_from AND p_date_to
      AND ct.assigned_to IS NOT NULL
  ),
  unique_contacts AS (
    SELECT DISTINCT ON (contact_id)
      contact_id,
      assigned_to,
      lead_status,
      detected_origin
    FROM contact_origins
    ORDER BY contact_id
  ),
  filtered_contacts AS (
    SELECT * FROM unique_contacts
    WHERE p_origin IS NULL OR detected_origin = p_origin
  )
  SELECT
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url as agent_avatar,
    COUNT(fc.contact_id)::BIGINT as lead_count,
    COUNT(fc.contact_id) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won'))::BIGINT as converted_count,
    CASE 
      WHEN COUNT(fc.contact_id) > 0 
      THEN ROUND((COUNT(fc.contact_id) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won'))::NUMERIC / COUNT(fc.contact_id)::NUMERIC) * 100, 1)
      ELSE 0
    END as conversion_rate
  FROM profiles p
  INNER JOIN filtered_contacts fc ON fc.assigned_to = p.id
  WHERE p.is_active = true
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY lead_count DESC;
END;
$$;