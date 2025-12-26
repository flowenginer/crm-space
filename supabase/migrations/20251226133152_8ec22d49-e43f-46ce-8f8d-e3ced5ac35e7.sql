-- Corrigir get_leads_by_origin para usar conversion_status_ids dinâmicos ao invés de status hardcoded
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(origin text, total_leads bigint, converted_leads bigint, conversion_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
  v_conversion_names text[];
BEGIN
  -- Se não foram passados nomes de status, buscar dinamicamente da configuração
  IF array_length(p_conversion_status_names, 1) IS NULL OR array_length(p_conversion_status_names, 1) = 0 THEN
    SELECT ARRAY(
      SELECT ls.name
      FROM lead_statuses ls
      WHERE ls.tenant_id = v_tenant_id
        AND ls.id IN (
          SELECT unnest(cs.conversion_status_ids)
          FROM company_settings cs
          WHERE cs.tenant_id = v_tenant_id
        )
    ) INTO v_conversion_names;
  ELSE
    v_conversion_names := p_conversion_status_names;
  END IF;

  RETURN QUERY
  WITH lead_data AS (
    SELECT 
      COALESCE(ct.origin, 'Não identificado') as lead_origin,
      ct.id as contact_id,
      ct.lead_status
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.tenant_id = v_tenant_id
      AND ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
  )
  SELECT 
    ld.lead_origin as origin,
    COUNT(DISTINCT ld.contact_id)::BIGINT as total_leads,
    COUNT(DISTINCT CASE WHEN ld.lead_status = ANY(v_conversion_names) THEN ld.contact_id END)::BIGINT as converted_leads,
    CASE 
      WHEN COUNT(DISTINCT ld.contact_id) > 0 
      THEN ROUND((COUNT(DISTINCT CASE WHEN ld.lead_status = ANY(v_conversion_names) THEN ld.contact_id END)::NUMERIC / COUNT(DISTINCT ld.contact_id)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM lead_data ld
  GROUP BY ld.lead_origin
  ORDER BY total_leads DESC;
END;
$function$;