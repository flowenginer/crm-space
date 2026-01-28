
-- Corrigir get_leads_by_origin para agrupar meta_ads e ctwa_ad corretamente
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(
  origin text,
  total_leads bigint,
  converted_leads bigint,
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
  WITH contact_origins AS (
    SELECT 
      c.id as contact_id,
      -- Normalizar origem: agrupar meta_ads e ctwa_ad como 'meta_ads'
      CASE 
        WHEN c.origin IN ('meta_ads', 'ctwa_ad') THEN 'meta_ads'
        WHEN c.origin = 'manual' THEN 'manual'
        WHEN c.origin = 'referral' THEN 'referral'
        WHEN c.origin = 'linktree' THEN 'linktree'
        WHEN c.origin = 'site' THEN 'site'
        WHEN c.origin = 'whatsapp' THEN 'whatsapp'
        WHEN c.origin IS NULL OR c.origin = '' THEN 'Não identificado'
        ELSE c.origin
      END as normalized_origin
    FROM contacts c
    WHERE c.tenant_id = v_tenant_id
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ),
  conversions AS (
    SELECT DISTINCT lsh.contact_id
    FROM lead_status_history lsh
    JOIN contacts c ON c.id = lsh.contact_id
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND lsh.new_status = ANY(p_conversion_status_names)
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
  )
  SELECT 
    co.normalized_origin as origin,
    COUNT(DISTINCT co.contact_id) as total_leads,
    COUNT(DISTINCT conv.contact_id) as converted_leads,
    ROUND(
      CASE 
        WHEN COUNT(DISTINCT co.contact_id) > 0 
        THEN (COUNT(DISTINCT conv.contact_id)::numeric / COUNT(DISTINCT co.contact_id)::numeric * 100)
        ELSE 0
      END, 
      2
    ) as conversion_rate
  FROM contact_origins co
  LEFT JOIN conversions conv ON conv.contact_id = co.contact_id
  GROUP BY co.normalized_origin
  ORDER BY total_leads DESC;
END;
$$;
