CREATE OR REPLACE FUNCTION public.get_returning_leads_metrics(p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_agent_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_origin text DEFAULT NULL::text)
 RETURNS TABLE(returning_count bigint, returning_conversion_count bigint, returning_conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.contact_id,
      ct.first_contact_at,
      c.lead_status
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
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
  ),
  returning_leads AS (
    SELECT DISTINCT contact_id
    FROM base_conversations
    WHERE first_contact_at IS NOT NULL 
      AND first_contact_at < p_date_from
  ),
  returning_conversions AS (
    SELECT DISTINCT bc.contact_id
    FROM base_conversations bc
    INNER JOIN company_settings cs ON true
    WHERE bc.first_contact_at IS NOT NULL 
      AND bc.first_contact_at < p_date_from
      AND bc.lead_status = ANY(cs.conversion_status_ids)
  )
  SELECT
    (SELECT COUNT(*) FROM returning_leads)::BIGINT as returning_count,
    (SELECT COUNT(*) FROM returning_conversions)::BIGINT as returning_conversion_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM returning_leads) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM returning_conversions)::NUMERIC / (SELECT COUNT(*) FROM returning_leads)::NUMERIC) * 100, 1)
      ELSE 0
    END as returning_conversion_rate;
END;
$function$;