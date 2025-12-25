-- Update get_agent_distribution_advanced to count conversions based on contact owner (contacts.assigned_to)
-- instead of conversation assigned_to, ensuring each conversion is attributed to the contact's responsible agent

CREATE OR REPLACE FUNCTION public.get_agent_distribution_advanced(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_department_id uuid DEFAULT NULL::uuid,
  p_conversion_status_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  avatar_url text,
  leads_received bigint,
  leads_responded bigint,
  conversions bigint,
  conversion_rate numeric,
  avg_response_time integer,
  meta_ads_count bigint,
  organic_count bigint,
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH agent_conversations AS (
    -- Conversations handled by each agent (for leads_received, responded, response time)
    SELECT 
      c.assigned_to,
      c.contact_id,
      c.first_response_at,
      c.created_at,
      c.referral_source
    FROM conversations c
    WHERE c.tenant_id = v_tenant_id
      AND c.assigned_to IS NOT NULL
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ),
  agent_stats AS (
    -- Stats per agent based on their conversations
    SELECT 
      ac.assigned_to,
      COUNT(*) as leads_count,
      SUM(CASE WHEN ac.first_response_at IS NOT NULL THEN 1 ELSE 0 END) as responded_count,
      COALESCE(AVG(CASE WHEN ac.first_response_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ac.first_response_at - ac.created_at)) 
        ELSE NULL END)::INTEGER, 0) as avg_resp_time,
      SUM(CASE WHEN ac.referral_source = 'meta_ads' THEN 1 ELSE 0 END) as meta_ads,
      SUM(CASE WHEN ac.referral_source IS NULL OR ac.referral_source = 'organic' THEN 1 ELSE 0 END) as organic,
      SUM(CASE WHEN ac.referral_source IS NOT NULL AND ac.referral_source NOT IN ('meta_ads', 'organic') THEN 1 ELSE 0 END) as other_origins
    FROM agent_conversations ac
    GROUP BY ac.assigned_to
  ),
  converted_contacts_by_owner AS (
    -- Count conversions by CONTACT OWNER (contacts.assigned_to), not conversation assigned_to
    -- This ensures each conversion is attributed to the responsible agent (owner) of the contact
    SELECT 
      ct.assigned_to as owner_id,
      COUNT(DISTINCT lsh.contact_id) as conversion_count
    FROM lead_status_history lsh
    INNER JOIN contacts ct ON ct.id = lsh.contact_id 
      AND ct.tenant_id = v_tenant_id
      AND ct.assigned_to IS NOT NULL
    WHERE lsh.new_status = ANY(p_conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
    GROUP BY ct.assigned_to
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(ast.leads_count, 0)::BIGINT as leads_received,
    COALESCE(ast.responded_count, 0)::BIGINT as leads_responded,
    -- Conversions now come from converted_contacts_by_owner (based on contact owner)
    COALESCE(cco.conversion_count, 0)::BIGINT as conversions,
    -- Conversion rate: conversions (by owner) / leads received * 100
    CASE WHEN COALESCE(ast.leads_count, 0) > 0 
      THEN (COALESCE(cco.conversion_count, 0)::NUMERIC / ast.leads_count * 100)
      ELSE 0 
    END as conversion_rate,
    COALESCE(ast.avg_resp_time, 0)::INTEGER as avg_response_time,
    COALESCE(ast.meta_ads, 0)::BIGINT as meta_ads_count,
    COALESCE(ast.organic, 0)::BIGINT as organic_count,
    COALESCE(ast.other_origins, 0)::BIGINT as other_count
  FROM profiles p
  INNER JOIN agent_stats ast ON ast.assigned_to = p.id
  LEFT JOIN converted_contacts_by_owner cco ON cco.owner_id = p.id
  WHERE p.tenant_id = v_tenant_id
    AND p.is_active = true
    AND ast.leads_count > 0
    AND (p_department_id IS NULL OR p.department_id = p_department_id)
  ORDER BY ast.leads_count DESC;
END;
$function$;