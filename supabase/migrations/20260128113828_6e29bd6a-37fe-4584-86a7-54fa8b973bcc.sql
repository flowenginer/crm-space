-- Fix origin filtering in all dashboard RPC functions to include 'ctwa_ad' as Meta Ads
-- The Cloud API webhook saves CTWA (Click-To-WhatsApp Ad) leads with referral_source='ctwa_ad'

-- 1. Fix get_lead_journey_metrics
CREATE OR REPLACE FUNCTION get_lead_journey_metrics(
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_date_to TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  assigned_conversations BIGINT,
  assignment_rate NUMERIC,
  new_contacts BIGINT,
  conversion_count BIGINT,
  conversion_rate NUMERIC,
  avg_time_to_assignment NUMERIC,
  avg_time_to_first_response NUMERIC,
  avg_time_in_funnel NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH filtered_conversations AS (
    SELECT 
      cv.id,
      cv.contact_id,
      cv.created_at,
      cv.first_response_at,
      cv.lead_status,
      cv.assigned_to,
      ct.first_contact_at
    FROM conversations cv
    INNER JOIN contacts ct ON ct.id = cv.contact_id AND ct.tenant_id = v_tenant_id
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
      AND (p_channel_id IS NULL OR cv.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        -- Meta Ads: include both 'meta_ads' and 'ctwa_ad' (Click-To-WhatsApp Ad)
        OR (p_origin = 'meta_ads' AND cv.referral_source IN ('meta_ads', 'ctwa_ad'))
        OR (p_origin = 'ctwa_ad' AND cv.referral_source IN ('meta_ads', 'ctwa_ad'))
        OR (p_origin = 'linktree' AND cv.referral_source = 'linktree')
        OR (p_origin = 'site' AND cv.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'whatsapp' AND ct.origin = 'whatsapp')
        OR (p_origin = 'organic_unknown' AND (
          cv.referral_source IS NULL OR cv.referral_source NOT IN ('meta_ads', 'ctwa_ad', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
          AND ct.origin IS DISTINCT FROM 'whatsapp')
        OR (p_origin = 'organic' AND (cv.referral_source IS NULL OR cv.referral_source NOT IN ('meta_ads', 'ctwa_ad')))
      )
  ),
  new_contacts_data AS (
    SELECT DISTINCT contact_id
    FROM filtered_conversations fc
    WHERE fc.first_contact_at >= p_date_from
      AND fc.first_contact_at <= p_date_to
  ),
  conversion_status_ids AS (
    SELECT unnest(cs.conversion_status_ids) as status_id
    FROM company_settings cs
    WHERE cs.tenant_id = v_tenant_id
  ),
  conversion_status_names AS (
    SELECT ls.name
    FROM lead_statuses ls
    WHERE ls.tenant_id = v_tenant_id
      AND ls.id IN (SELECT status_id FROM conversion_status_ids)
  ),
  conversions AS (
    SELECT DISTINCT fc.contact_id
    FROM filtered_conversations fc
    INNER JOIN lead_status_history lsh ON lsh.contact_id = fc.contact_id
    WHERE lsh.new_status IN (SELECT name FROM conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
  ),
  assignment_times AS (
    SELECT 
      lah.conversation_id,
      MIN(lah.time_to_assign_seconds) as time_to_assign
    FROM lead_assignment_history lah
    INNER JOIN filtered_conversations fc ON fc.id = lah.conversation_id
    WHERE lah.assignment_type = 'first_assignment'
    GROUP BY lah.conversation_id
  ),
  funnel_times AS (
    SELECT 
      lsh.contact_id,
      SUM(lsh.duration_seconds) as total_funnel_time
    FROM lead_status_history lsh
    INNER JOIN filtered_conversations fc ON fc.contact_id = lsh.contact_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
    GROUP BY lsh.contact_id
  ),
  conversation_counts AS (
    SELECT 
      COUNT(DISTINCT id) as total_conv,
      COUNT(DISTINCT CASE WHEN assigned_to IS NOT NULL THEN id END) as assigned_conv
    FROM filtered_conversations
  )
  SELECT
    cc.total_conv::BIGINT as total_conversations,
    cc.assigned_conv::BIGINT as assigned_conversations,
    CASE 
      WHEN cc.total_conv > 0 
      THEN ROUND((cc.assigned_conv::NUMERIC / cc.total_conv::NUMERIC) * 100, 2)
      ELSE 0
    END as assignment_rate,
    (SELECT COUNT(*) FROM new_contacts_data)::BIGINT as new_contacts,
    (SELECT COUNT(*) FROM conversions)::BIGINT as conversion_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM new_contacts_data) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM conversions)::NUMERIC / (SELECT COUNT(*) FROM new_contacts_data)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate,
    COALESCE((SELECT AVG(time_to_assign) FROM assignment_times), 0)::NUMERIC as avg_time_to_assignment,
    COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (fc.first_response_at - fc.created_at)))
      FROM filtered_conversations fc
      WHERE fc.first_response_at IS NOT NULL
    ), 0)::NUMERIC as avg_time_to_first_response,
    COALESCE((SELECT AVG(total_funnel_time) FROM funnel_times), 0)::NUMERIC as avg_time_in_funnel
  FROM conversation_counts cc;
END;
$$;

-- 2. Fix get_returning_leads_metrics
CREATE OR REPLACE FUNCTION get_returning_leads_metrics(
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_date_to TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  new_contacts BIGINT,
  returning_contacts BIGINT,
  new_contact_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.id,
      c.contact_id,
      c.created_at,
      ct.first_contact_at
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.tenant_id = v_tenant_id
      AND ct.tenant_id = v_tenant_id
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        -- Meta Ads: include both 'meta_ads' and 'ctwa_ad' (Click-To-WhatsApp Ad)
        OR (p_origin = 'meta_ads' AND c.referral_source IN ('meta_ads', 'ctwa_ad'))
        OR (p_origin = 'ctwa_ad' AND c.referral_source IN ('meta_ads', 'ctwa_ad'))
        OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
        OR (p_origin = 'site' AND c.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'whatsapp' AND ct.origin = 'whatsapp')
        OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'ctwa_ad', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
          AND ct.origin IS DISTINCT FROM 'whatsapp')
        OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'ctwa_ad')))
      )
  ),
  new_unique_contacts AS (
    SELECT DISTINCT bc.contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at >= p_date_from
      AND bc.first_contact_at <= p_date_to
  ),
  returning_unique_contacts AS (
    SELECT DISTINCT bc.contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at < p_date_from
  )
  SELECT
    (SELECT COUNT(*) FROM base_conversations)::BIGINT as total_conversations,
    (SELECT COUNT(*) FROM new_unique_contacts)::BIGINT as new_contacts,
    (SELECT COUNT(*) FROM returning_unique_contacts)::BIGINT as returning_contacts,
    CASE 
      WHEN ((SELECT COUNT(*) FROM new_unique_contacts) + (SELECT COUNT(*) FROM returning_unique_contacts)) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM new_unique_contacts)::NUMERIC / ((SELECT COUNT(*) FROM new_unique_contacts) + (SELECT COUNT(*) FROM returning_unique_contacts))::NUMERIC) * 100, 1)
      ELSE 0
    END as new_contact_rate;
END;
$$;

-- 3. Fix get_leads_distribution_by_agent
CREATE OR REPLACE FUNCTION get_leads_distribution_by_agent(
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_date_to TIMESTAMP WITH TIME ZONE,
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
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  WITH contact_with_agent AS (
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      cv.assigned_to as contact_agent_id,
      ct.lead_status,
      ct.origin as contact_origin,
      cv.referral_source,
      CASE
        -- Normalize Meta Ads origins (both 'meta_ads' and 'ctwa_ad')
        WHEN cv.referral_source IN ('meta_ads', 'ctwa_ad') THEN 'ctwa_ad'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        WHEN ct.origin = 'whatsapp' THEN 'whatsapp'
        ELSE 'organic_unknown'
      END as detected_origin
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.tenant_id = v_tenant_id
      AND cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
    ORDER BY ct.id, cv.created_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT 
      cwa.contact_id, 
      cwa.contact_agent_id, 
      cwa.lead_status, 
      cwa.detected_origin
    FROM contact_with_agent cwa
    WHERE cwa.contact_agent_id IS NOT NULL
      AND (p_origin IS NULL 
        -- Match both meta_ads and ctwa_ad as the same origin
        OR (p_origin IN ('meta_ads', 'ctwa_ad') AND cwa.detected_origin = 'ctwa_ad')
        OR (p_origin = 'whatsapp' AND cwa.detected_origin = 'whatsapp')
        OR cwa.detected_origin = p_origin)
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
    AND pr.tenant_id = v_tenant_id
  GROUP BY pr.id, pr.full_name, pr.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$$;