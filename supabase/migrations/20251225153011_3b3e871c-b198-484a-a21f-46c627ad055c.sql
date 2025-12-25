-- Atualizar a função get_lead_journey_metrics para incluir assigned_conversations e assignment_rate
CREATE OR REPLACE FUNCTION get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
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
SECURITY DEFINER
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
        OR (p_origin = 'meta_ads' AND cv.referral_source = 'meta_ads')
        OR (p_origin = 'linktree' AND cv.referral_source = 'linktree')
        OR (p_origin = 'site' AND cv.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic_unknown' AND (
          cv.referral_source IS NULL OR cv.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic' AND (cv.referral_source IS NULL OR cv.referral_source != 'meta_ads'))
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
  -- Calcular totais de conversas e atribuições
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