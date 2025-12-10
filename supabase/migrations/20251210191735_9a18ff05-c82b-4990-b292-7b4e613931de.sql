-- Drop and recreate get_leads_by_origin with detailed origins
DROP FUNCTION IF EXISTS get_leads_by_origin(timestamptz, timestamptz, uuid, uuid, text[]);

CREATE OR REPLACE FUNCTION get_leads_by_origin(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_conversion_status_names text[] DEFAULT ARRAY['Convertido', 'Fechado', 'Ganho', 'Won']
)
RETURNS TABLE (
  origin text,
  total bigint,
  converted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH contact_origins AS (
    SELECT
      ct.id as contact_id,
      CASE
        -- Meta Ads: quando tem referral_source = 'meta_ads' ou origin = 'meta_ads'
        WHEN cv.referral_source = 'meta_ads' OR ct.origin = 'meta_ads' THEN 'meta_ads'
        -- Linktree: quando referral_source = 'linktree' ou origin contém linktree
        WHEN cv.referral_source = 'linktree' OR ct.origin ILIKE '%linktree%' THEN 'linktree'
        -- Site: quando referral_source = 'site' ou origin contém site/website
        WHEN cv.referral_source = 'site' OR ct.origin ILIKE '%site%' OR ct.origin ILIKE '%website%' THEN 'site'
        -- Indicação: quando origin contém indicação/referral
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        -- Manual: quando foi importado ou criado manualmente
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        -- Orgânico (outros): qualquer outro caso
        ELSE 'organic_unknown'
      END as detected_origin,
      ct.lead_status
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.created_at BETWEEN p_date_from AND p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
  ),
  unique_contacts AS (
    SELECT DISTINCT ON (contact_id)
      contact_id,
      detected_origin,
      lead_status
    FROM contact_origins
    ORDER BY contact_id
  )
  SELECT
    uc.detected_origin as origin,
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE uc.lead_status = ANY(p_conversion_status_names))::bigint as converted
  FROM unique_contacts uc
  GROUP BY uc.detected_origin
  ORDER BY total DESC;
END;
$$;