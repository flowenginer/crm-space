-- Corrigir função get_lead_journey_metrics para contar contatos únicos em vez de conversas
-- Isso vai alinhar os KPIs com o gráfico "Leads por Origem"

CREATE OR REPLACE FUNCTION public.get_lead_journey_metrics(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  total_conversations bigint, 
  unique_contacts bigint,
  assigned_conversations bigint, 
  assigned_unique_contacts bigint,
  converted_conversations bigint, 
  converted_unique_contacts bigint,
  assignment_rate numeric, 
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.id as conversation_id,
      c.contact_id,
      c.assigned_to,
      c.lead_status,
      ct.first_contact_at,
      ct.origin as contact_origin
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
        OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
        OR (p_origin = 'site' AND c.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
      )
      -- Filtro para NOVOS contatos (first_contact_at dentro do período)
      AND ct.first_contact_at >= p_date_from
      AND ct.first_contact_at <= p_date_to
  ),
  metrics AS (
    SELECT
      COUNT(*) as total_conv,
      COUNT(DISTINCT contact_id) as unique_cont,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_conv,
      COUNT(DISTINCT contact_id) FILTER (WHERE assigned_to IS NOT NULL) as assigned_cont
    FROM base_conversations
  ),
  conversion_metrics AS (
    SELECT
      COUNT(*) as converted_conv,
      COUNT(DISTINCT bc.contact_id) as converted_cont
    FROM base_conversations bc
    INNER JOIN company_settings cs ON true
    WHERE bc.lead_status = ANY(cs.conversion_status_ids)
  )
  SELECT
    m.total_conv::BIGINT as total_conversations,
    m.unique_cont::BIGINT as unique_contacts,
    m.assigned_conv::BIGINT as assigned_conversations,
    m.assigned_cont::BIGINT as assigned_unique_contacts,
    cm.converted_conv::BIGINT as converted_conversations,
    cm.converted_cont::BIGINT as converted_unique_contacts,
    CASE 
      WHEN m.unique_cont > 0 
      THEN ROUND((m.assigned_cont::NUMERIC / m.unique_cont::NUMERIC) * 100, 1)
      ELSE 0
    END as assignment_rate,
    CASE 
      WHEN m.unique_cont > 0 
      THEN ROUND((cm.converted_cont::NUMERIC / m.unique_cont::NUMERIC) * 100, 1)
      ELSE 0
    END as conversion_rate
  FROM metrics m
  CROSS JOIN conversion_metrics cm;
END;
$function$;